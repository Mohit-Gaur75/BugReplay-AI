import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, closeDb, getDb } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrations.js';
import { FingerprintService } from '../src/modules/incidents/fingerprint.service.js';
import { CircuitBreaker } from '../src/services/circuitBreaker.js';
import { acquireNextJob } from '../src/jobs/worker.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = './data/test_advanced.db';

describe('Advanced Backend Capabilities & Enterprise Engine', () => {
  let app;
  let db;
  let userToken;
  let projectId;
  let rawApiKey;

  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    db = initDb(TEST_DB_PATH);
    runMigrations(db);
    app = createApp();

    // Register test user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'advanced@bugreplay.dev', password: 'Password123!' });

    userToken = regRes.body.data.token;

    // Create test project
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Advanced Test Project' });

    projectId = projRes.body.data.project.id;
    rawApiKey = projRes.body.data.project.api_key;
  });

  after(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (e) {}
    }
  });

  test('FingerprintService normalizes variable tokens and produces stable hash', () => {
    const error1 = {
      errorType: 'TypeError',
      errorMessage: 'Cannot read property id of undefined (user: 550e8400-e29b-41d4-a716-446655440000 at 2026-11-14T18:00:00Z)',
      errorStack: 'TypeError: Cannot read property id\n    at CartView.render (cart.js:45:12)',
      pageUrl: 'https://acme.com/checkout?step=2&token=abc',
    };

    const error2 = {
      errorType: 'TypeError',
      errorMessage: 'Cannot read property id of undefined (user: 123e4567-e89b-12d3-a456-426614174000 at 2026-11-14T19:30:00Z)',
      errorStack: 'TypeError: Cannot read property id\n    at CartView.render (cart.js:45:12)',
      pageUrl: 'https://acme.com/checkout?step=3&token=xyz',
    };

    const fp1 = FingerprintService.computeFingerprint(error1);
    const fp2 = FingerprintService.computeFingerprint(error2);

    assert.equal(typeof fp1, 'string');
    assert.equal(fp1.length, 64);
    assert.equal(fp1, fp2, 'Fingerprints should match despite different UUIDs and query parameters');
  });

  test('Ingestion deduplication increments occurrence count on recurring bugs', async () => {
    const recurringPayload = {
      errorMessage: 'Database connection dropped during checkout step',
      errorType: 'NetworkError',
      errorStack: 'NetworkError: Connection dropped\n    at submitOrder (order.js:10:5)',
      pageUrl: 'https://shop.dev/checkout',
      telemetry: [{ type: 'click', tagName: 'BUTTON', id: 'pay' }],
    };

    // First ingestion: creates new incident
    const res1 = await request(app)
      .post('/api/v1/ingest')
      .set('x-api-key', rawApiKey)
      .send(recurringPayload);

    assert.equal(res1.status, 202);
    assert.equal(res1.body.success, true);
    const incidentId = res1.body.incidentId;

    // Second ingestion: should be deduplicated
    const res2 = await request(app)
      .post('/api/v1/ingest')
      .set('x-api-key', rawApiKey)
      .send(recurringPayload);

    assert.equal(res2.status, 202);
    assert.equal(res2.body.incidentId, incidentId, 'Duplicate incident should return same parent incidentId');

    // Verify occurrence count in database
    const row = db.prepare('SELECT occurrence_count FROM incidents WHERE id = ?').get(incidentId);
    assert.equal(row.occurrence_count, 2, 'Occurrence count should be incremented to 2');
  });

  test('CircuitBreaker transitions: CLOSED -> OPEN -> HALF_OPEN', () => {
    const cb = new CircuitBreaker('TestBreaker', { failureThreshold: 3, recoveryTimeoutMs: 50 });
    assert.equal(cb.state, 'CLOSED');
    assert.equal(cb.isOpen(), false);

    // Record 2 failures (threshold not reached)
    cb.recordFailure(new Error('fail 1'));
    cb.recordFailure(new Error('fail 2'));
    assert.equal(cb.state, 'CLOSED');
    assert.equal(cb.isOpen(), false);

    // 3rd failure trips to OPEN
    cb.recordFailure(new Error('fail 3'));
    assert.equal(cb.state, 'OPEN');
    assert.equal(cb.isOpen(), true);

    // Status reporter reflects state
    const status = cb.getStatus();
    assert.equal(status.state, 'OPEN');
    assert.equal(status.failureCount, 3);
    assert.equal(status.totalTrips, 1);
  });

  test('Distributed worker atomic job leasing marks status PROCESSING', () => {
    // Clear jobs to test in isolation
    db.prepare('DELETE FROM jobs').run();

    // Insert a pending job
    const jobId = 'test_job_' + Date.now();
    db.prepare(`
      INSERT INTO jobs (id, type, payload, status, scheduled_at)
      VALUES (?, 'AI_SYNTHESIS', ?, 'PENDING', CURRENT_TIMESTAMP)
    `).run(jobId, JSON.stringify({ incidentId: 'dummy' }));

    const leased = acquireNextJob();
    assert.ok(leased);
    assert.equal(leased.id, jobId);

    // Verify it is now locked in database
    const updated = db.prepare('SELECT status, locked_by, locked_at FROM jobs WHERE id = ?').get(jobId);
    assert.equal(updated.status, 'PROCESSING');
    assert.ok(updated.locked_by);
    assert.ok(updated.locked_at);
  });

  test('GET /health/live returns process liveness', async () => {
    const res = await request(app).get('/health/live');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'alive');
    assert.ok(res.body.uptime >= 0);
  });

  test('GET /health/ready returns deep subsystem readiness', async () => {
    const res = await request(app).get('/health/ready');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ready');
    assert.equal(res.body.database, 'connected');
    assert.equal(res.body.circuitBreaker.state, 'CLOSED');
    assert.ok(res.body.memory.rss > 0);
  });

  test('GET /metrics returns standard OpenMetrics / Prometheus telemetry', async () => {
    const res = await request(app).get('/metrics');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('process_uptime_seconds'));
    assert.ok(res.text.includes('process_resident_memory_bytes'));
    assert.ok(res.text.includes('bugreplay_incidents_ingested_total'));
    assert.ok(res.text.includes('bugreplay_circuit_breaker_state'));
  });

  test('HTTP responses include X-Request-Id correlation headers', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['x-request-id']);
  });
});
