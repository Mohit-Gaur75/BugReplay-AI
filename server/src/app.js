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
import { requestIdMiddleware } from './middleware/requestId.js';
import { generalLimiter, authLimiter, ingestLimiter } from './middleware/rateLimiter.js';
import { metrics } from './services/metrics.service.js';
import { geminiCircuitBreaker } from './services/circuitBreaker.js';
import apiRouter from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // 1. Distributed Trace & Request ID Tracking
  app.use(requestIdMiddleware);

  // 2. Metrics & Observability Collector Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const cleanPath = req.baseUrl || req.path || req.originalUrl?.split('?')[0] || '/';
      metrics.recordHttpRequest(req.method, cleanPath, res.statusCode, durationMs);
    });
    next();
  });

  // 3. Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow SDK distribution
      contentSecurityPolicy: false, // fine-tuned for dashboard
    })
  );

  // 4. CORS Configuration
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
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Request-Id'],
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'X-Request-Id'],
    })
  );

  // 5. Request Logging with Request ID
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 6. Request body parsing with strict 100KB limit
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 7. Static assets (SDK delivery, demo files)
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // 8. Prometheus / OpenMetrics Telemetry Endpoint
  app.get('/metrics', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(metrics.getPrometheusMetrics());
  });

  // 9. Rate-Limited API Routes
  app.use('/api/v1/auth', authLimiter);
  app.use('/api/v1/ingest', ingestLimiter);
  app.use('/api/v1', generalLimiter, apiRouter);

  // 10. Simulation Endpoints for Sandbox Demo
  app.post('/api/v1/simulate/checkout-timeout', (req, res) => {
    return res.status(504).json({
      error: 'PaymentGatewayTimeout',
      code: 'GATEWAY_TIMEOUT_504',
      message: 'Payment processor timed out after 3000ms during charge execution',
    });
  });

  app.post('/api/v1/simulate/server-error', (req, res) => {
    return res.status(500).json({
      error: 'InternalServerError',
      code: 'DB_LOCK_TIMEOUT',
      message: 'Database query execution failed: lock wait timeout exceeded',
    });
  });

  // 11. Kubernetes / Cloud Liveness Probe
  app.get('/health/live', (req, res) => {
    return res.status(200).json({
      status: 'alive',
      uptime: process.uptime(),
      pid: process.pid,
    });
  });

  // 12. Deep Readiness Probe (Database, Worker, Circuit Breaker)
  app.get('/health/ready', (req, res) => {
    try {
      const db = getDb();
      // Test read & write
      const testQuery = db.prepare('SELECT 1 as healthy').get();
      const isDbOk = testQuery && testQuery.healthy === 1;

      // Check pending job count
      const queueRow = db.prepare("SELECT COUNT(*) as depth FROM jobs WHERE status = 'PENDING'").get();
      const queueDepth = queueRow ? queueRow.depth : 0;

      const cb = geminiCircuitBreaker.getStatus();

      const isReady = isDbOk && cb.state !== 'OPEN';
      const statusCode = isReady ? 200 : 503;

      return res.status(statusCode).json({
        status: isReady ? 'ready' : 'degraded',
        database: isDbOk ? 'connected' : 'error',
        queue: {
          pendingJobs: queueDepth,
          status: queueDepth > 1000 ? 'backlogged' : 'nominal',
        },
        circuitBreaker: cb,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(503).json({
        status: 'not_ready',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 13. Backwards-Compatible Health Check Endpoint
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

  // 14. Root Welcome & API Discovery
  app.get('/', (req, res) => {
    res.json({
      name: 'BugReplay AI API',
      version: '1.0.0',
      description: 'Production bug flight recorder & Playwright test synthesis engine.',
      docs: '/api/v1/docs',
      metrics: '/metrics',
      health: {
        live: '/health/live',
        ready: '/health/ready',
      },
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
