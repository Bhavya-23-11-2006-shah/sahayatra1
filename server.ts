import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import {fileURLToPath} from 'url';
import {apiLimiter} from './src/server/middleware/security.ts';
import {openApiSpec} from './src/server/openapi.ts';
import {initRealtimeServer} from './src/server/realtime/socket.ts';
import {apiRouter} from './src/server/routes/api.ts';
import {logger} from './src/server/utils/logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Trust proxy for Cloud Run / reverse proxies (required for express-rate-limit)
  app.set('trust proxy', 1);

  // Security headers configured to allow Vite iframe preview & Leaflet map tiles
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    }),
  );

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({limit: '1mb'}));

  // Swagger / OpenAPI Documentation
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Rate-limited REST API routes
  app.use('/api', apiLimiter, apiRouter);

  // Socket.IO Real-Time Bus Tracking & Conductor Alerts
  initRealtimeServer(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !disableHmr,
        ws: disableHmr ? false : {server: httpServer, path: '/vite-hmr'},
      },
      appType: 'spa',
    });
    if (disableHmr) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (!transformed) {
            next();
            return;
          }
          const patched = transformed.code.replace(
            /const transport = normalizeModuleRunnerTransport\([\s\S]*?let willUnload = false;/,
            'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });let willUnload = false;',
          );
          res.setHeader('Cache-Control', 'no-cache');
          res.type('application/javascript').send(patched);
        } catch (err) {
          next(err);
        }
      });
    }
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info('SahayYatra full-stack server listening', {
      url: `http://0.0.0.0:${PORT}`,
      docs: `http://0.0.0.0:${PORT}/api/docs`,
    });
  });
}

startServer();
