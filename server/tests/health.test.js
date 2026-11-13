import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, closeDb } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrations.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.resolve(__dirname, 'test_health.db');

describe('Phase 1 Foundation: Database & Health Endpoints', () => {
  let app;
  let db;

  before(() => {
    // Clean up any previous test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = initDb(testDbPath);
    runMigrations(db);
    app = createApp();
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // file lock cleanup
      }
    }
  });

  test('GET /health returns healthy status and connected database', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.equal(res.body.database, 'connected');
    assert.ok(typeof res.body.uptime === 'number');
    assert.ok(res.body.timestamp);
  });

  test('GET / returns API discovery metadata', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'BugReplay AI API');
    assert.equal(res.body.version, '1.0.0');
  });

  test('GET /non-existent-route returns 404 standard error format', async () => {
    const res = await request(app).get('/non-existent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  test('Database has all migration tables initialized in WAL mode', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);

    assert.ok(tables.includes('users'), 'users table should exist');
    assert.ok(tables.includes('projects'), 'projects table should exist');
    assert.ok(tables.includes('incidents'), 'incidents table should exist');
    assert.ok(tables.includes('usage_records'), 'usage_records table should exist');
    assert.ok(tables.includes('subscriptions'), 'subscriptions table should exist');
    assert.ok(tables.includes('audit_logs'), 'audit_logs table should exist');
    assert.ok(tables.includes('jobs'), 'jobs table should exist');
    assert.ok(tables.includes('migrations'), 'migrations table should exist');

    const pragmaJournal = db.pragma('journal_mode', { simple: true });
    assert.equal(pragmaJournal.toLowerCase(), 'wal', 'journal_mode must be wal');

    const pragmaFk = db.pragma('foreign_keys', { simple: true });
    assert.equal(pragmaFk, 1, 'foreign_keys must be enabled');
  });
});
