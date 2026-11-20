import {db} from '../../db/index.ts';
import {auditLogs} from '../../db/schema.ts';

export const logger = {
  info(message: string, meta: Record<string, unknown> = {}) {
    console.log(JSON.stringify({level: 'info', ts: new Date().toISOString(), message, ...meta}));
  },
  warn(message: string, meta: Record<string, unknown> = {}) {
    console.warn(JSON.stringify({level: 'warn', ts: new Date().toISOString(), message, ...meta}));
  },
  error(message: string, meta: Record<string, unknown> = {}) {
    console.error(JSON.stringify({level: 'error', ts: new Date().toISOString(), message, ...meta}));
  },
};

export async function writeAuditLog(entry: {
  actorUserId?: number | null;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole ?? 'SYSTEM',
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadataJson: entry.metadata ?? {},
      ipAddress: entry.ipAddress ?? '',
    });
  } catch (err) {
    logger.error('Failed to write audit log', {
      action: entry.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
