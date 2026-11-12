import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import ingestRoutes from './routes/ingest.js';
import incidentsRoutes from './routes/incidents.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite schema and seed demo records
initDb();

const app = express();
const PORT = process.env.PORT || 3001;

// Security and utility middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(morgan('dev'));

// Large payload parser for rich telemetry ring buffer JSON
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Serve static SDK (public/bugreplay.js)
const publicDir = path.resolve(__dirname, '../../public');
app.use(express.static(publicDir));

// API Health Check
app.get(['/health', '/api/v1/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'BugReplay AI Ingestion & Synthesis Engine',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/ingest', ingestRoutes);
app.use('/api/v1/incidents', incidentsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[BugReplay Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  });
});

// Only start listening if executed directly (not when imported in tests)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  app.listen(PORT, () => {
    console.log(`[BugReplay AI] Server running on http://localhost:${PORT}`);
    console.log(`[BugReplay AI] SDK available at http://localhost:${PORT}/bugreplay.js`);
  });
}

export default app;
