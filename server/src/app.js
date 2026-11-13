import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { getDb } from './db/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { errorResponse } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow SDK distribution
      contentSecurityPolicy: false, // will be fine-tuned for dashboard
    })
  );

  // CORS Configuration
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Allow client capture across origins, domain policy enforced per-project
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    })
  );

  // Request Logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // Request body parsing with strict 100KB limit
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Static assets (SDK delivery, demo files)
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // Health Check Endpoint
  app.get('/health', (req, res) => {
    try {
      const db = getDb();
      const testQuery = db.prepare('SELECT 1 as healthy').get();
      return res.status(200).json({
        status: 'healthy',
        database: testQuery && testQuery.healthy === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(503).json({
        status: 'unhealthy',
        database: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Root Welcome & API Discovery
  app.get('/', (req, res) => {
    res.json({
      name: 'BugReplay AI API',
      version: '1.0.0',
      description: 'Turn production bugs into reproducible Playwright tests automatically.',
      docs: '/api/v1/docs',
      health: '/health',
    });
  });

  // 404 Route Handler
  app.use((req, res) => {
    errorResponse(res, `Route ${req.method} ${req.originalUrl} not found`, 'NOT_FOUND', 404);
  });

  // Centralized Error Handler Middleware
  app.use(errorHandler);

  return app;
}
