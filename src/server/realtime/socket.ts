import type {Server as HttpServer} from 'http';
import {Server as SocketIOServer} from 'socket.io';
import {and, eq, lt} from 'drizzle-orm';
import {ROUTES, STOPS} from '../../data/seed.ts';
import {db} from '../../db/index.ts';
import {conductorAcks, users} from '../../db/schema.ts';
import {logger} from '../utils/logger.ts';

let ioInstance: SocketIOServer | null = null;

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

export function initRealtimeServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
    destroyUpgrade: false,
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    socket.on('join:trip', (tripId: string) => {
      if (typeof tripId === 'string' && tripId.trim()) {
        void socket.join(`trip:${tripId}`);
      }
    });

    socket.on('leave:trip', (tripId: string) => {
      if (typeof tripId === 'string') {
        void socket.leave(`trip:${tripId}`);
      }
    });

    socket.on('join:conductor', (conductorId: string | number) => {
      void socket.join(`conductor:${conductorId}`);
    });
  });

  // Mock GPS emitter advancing buses along route stops every 4s
  const routeProgress = new Map<string, number>();
  const gpsTimer = setInterval(() => {
    for (const route of ROUTES.slice(0, 3)) {
      const tripId = `trip-bus-${route.id === 'rt-305' ? '1' : route.id === 'rt-204' ? '4' : '6'}`;
      const prev = routeProgress.get(tripId) ?? 0.5;
      const maxIdx = Math.max(1, route.stopIds.length - 1);
      const next = prev + 0.15 >= maxIdx ? 0 : prev + 0.15;
      routeProgress.set(tripId, next);

      const idx = Math.floor(next);
      const frac = next - idx;
      const currStop = STOPS.find((s) => s.id === route.stopIds[idx]) || STOPS[0];
      const nextStop =
        STOPS.find((s) => s.id === route.stopIds[Math.min(maxIdx, idx + 1)]) || STOPS[1];

      const lat = currStop.lat + (nextStop.lat - currStop.lat) * frac;
      const lng = currStop.lng + (nextStop.lng - currStop.lng) * frac;
      const stopsRemaining = Math.max(0, Math.ceil(maxIdx - next));

      io.to(`trip:${tripId}`).emit('bus:position', {
        tripId,
        routeNumber: route.number,
        lat,
        lng,
        currentStopName: currStop.name,
        nextStopName: nextStop.name,
        etaMinutes: Math.max(1, stopsRemaining * 3),
        stopsAway: stopsRemaining,
        ts: new Date().toISOString(),
      });

      if (stopsRemaining === 2) {
        io.to(`trip:${tripId}`).emit('bus:stops-away', {
          tripId,
          stopsAway: 2,
          message: `Bus ${route.number} is 2 stops away near ${currStop.name}.`,
        });
      }
    }
  }, 4000);
  gpsTimer.unref();

  // Check un-acknowledged conductor alerts > 5 minutes and escalate to depot control
  const escalationTimer = setInterval(async () => {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const stale = await db
        .select()
        .from(conductorAcks)
        .where(
          and(
            eq(conductorAcks.acknowledged, false),
            eq(conductorAcks.escalatedToDepot, false),
            lt(conductorAcks.createdAt, fiveMinAgo),
          ),
        );

      if (stale.length > 0) {
        const backupConductor = await db.query.users.findFirst({
          where: eq(users.role, 'CONDUCTOR'),
        });
        for (const ack of stale) {
          await db
            .update(conductorAcks)
            .set({
              escalatedToDepot: true,
              reassignedConductorId: backupConductor?.id ?? ack.conductorId,
            })
            .where(eq(conductorAcks.id, ack.id));

          io.to(`trip:${ack.tripId}`).emit('conductor:escalated', {
            bookingId: ack.bookingId,
            tripId: ack.tripId,
            message: 'Conductor un-acknowledged for 5 min — escalated to depot control.',
          });
        }
      }
    } catch (err) {
      logger.warn('Escalation check skipped', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, 60000);
  escalationTimer.unref();

  return io;
}
