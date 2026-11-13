import { createApp } from './app.js';
import { env } from './config/env.js';
import { initDb, closeDb } from './db/db.js';
import { runMigrations } from './db/migrations.js';
import { startWorker, stopWorker } from './jobs/worker.js';

async function bootstrap() {
  try {
    console.log('🚀 Initializing BugReplay AI Backend Engine...');
    
    // 1. Initialize SQLite database & Pragmas
    initDb();
    console.log('✓ SQLite database connected in WAL mode.');

    // 2. Run Database Migrations
    runMigrations();
    console.log('✓ Migrations verified and up to date.');

    // 3. Start Durable Background Job Worker
    startWorker(2000);

    // 4. Create Express App & Start Server
    const app = createApp();
    let currentServer = null;

    const startServerOnPort = (port, retries = 3) => {
      const srv = app.listen(port, () => {
        console.log(`\n=================================================`);
        console.log(`🎯 BugReplay AI Server running on port ${port}`);
        console.log(`📡 Health Check: http://localhost:${port}/health`);
        console.log(`🌍 Environment: ${env.NODE_ENV}`);
        console.log(`=================================================\n`);
      });

      srv.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && retries > 0) {
          console.warn(`⚠️ Port ${port} is in use (e.g. by Docker/WSL). Automatically trying port ${port + 1}...`);
          currentServer = startServerOnPort(port + 1, retries - 1);
        } else {
          console.error('Fatal server listen error:', err.message);
          process.exit(1);
        }
      });

      return srv;
    };

    currentServer = startServerOnPort(env.PORT);

    // Graceful Shutdown Handler
    const shutdown = (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      stopWorker();
      if (currentServer) {
        currentServer.close(() => {
          console.log('HTTP server closed.');
          closeDb();
          console.log('Database connection closed.');
          process.exit(0);
        });
      } else {
        closeDb();
        process.exit(0);
      }

      // Force exit if not closed within 10s
      setTimeout(() => {
        console.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();
