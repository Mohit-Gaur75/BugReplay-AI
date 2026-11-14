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
const testDbPath = path.resolve(__dirname, 'test_ingest.db');

describe('Phase 4: Telemetry Ingestion & Incident Management APIs', () => {
  let app;
  let db;
  let userToken;
  let projectId;
  let rawApiKey;
  let createdIncidentId;

  before(async () => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
    db = initDb(testDbPath);
    runMigrations(db);
    app = createApp();

    // 1. Register user
    const userRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'qa@bugreplay.dev', password: 'Password123!' });
    userToken = userRes.body.data.token;

    // 2. Create project
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'E-Commerce Storefront', allowed_domains: 'localhost,example.com' });

    projectId = projRes.body.data.project.id;
    rawApiKey = projRes.body.data.project.api_key;
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  const sampleIncidentPayload = {
    errorMessage: "Cannot read properties of undefined (reading 'price')",
    errorType: 'TypeError',
    errorStack: "TypeError: Cannot read properties of undefined (reading 'price')\n    at Cart.render (cart.js:42)",
    pageUrl: 'http://localhost:5173/checkout',
    viewport: '1440x900',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    telemetry: [
      {
        type: 'click',
        tagName: 'BUTTON',
        id: 'checkout-btn',
        selector: 'button#checkout-btn',
        innerText: 'Proceed to Checkout',
      },
      {
        type: 'network',
        method: 'POST',
        url: '/api/v1/cart/items',
        status: 500,
        durationMs: 120,
        responseBody: { error: 'Internal Server Error' },
      },
    ],
  };

  test('POST /api/v1/ingest rejects requests with missing API key (401)', async () => {
    const res = await request(app)
      .post('/api/v1/ingest')
      .send(sampleIncidentPayload);

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'MISSING_API_KEY');
  });

  test('POST /api/v1/ingest rejects requests with invalid API key (401)', async () => {
    const res = await request(app)
      .post('/api/v1/ingest')
      .set('x-api-key', 'br_live_invalid_random_key_that_does_not_exist')
      .send(sampleIncidentPayload);

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_API_KEY');
  });

  test('POST /api/v1/ingest rejects requests from disallowed origin (403)', async () => {
    const res = await request(app)
      .post('/api/v1/ingest')
      .set('x-api-key', rawApiKey)
      .set('Origin', 'https://malicious-site.com')
      .send(sampleIncidentPayload);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'DOMAIN_NOT_ALLOWED');
  });

  test('POST /api/v1/ingest accepts valid telemetry and returns 202 Accepted', async () => {
    const res = await request(app)
      .post('/api/v1/ingest')
      .set('x-api-key', rawApiKey)
      .set('Origin', 'http://localhost:5173')
      .send(sampleIncidentPayload);

    assert.equal(res.status, 202);
    assert.equal(res.body.success, true);
    assert.ok(res.body.incidentId);
    assert.equal(res.body.generationStatus, 'PENDING');

    createdIncidentId = res.body.incidentId;

    // Verify database persistence
    const incidentRow = db.prepare('SELECT * FROM incidents WHERE id = ?').get(createdIncidentId);
    assert.ok(incidentRow);
    assert.equal(incidentRow.error_message, sampleIncidentPayload.errorMessage);
    assert.equal(incidentRow.status, 'OPEN');
    assert.equal(incidentRow.generation_status, 'PENDING');

    // Verify background job queued
    const jobRow = db.prepare("SELECT * FROM jobs WHERE status = 'PENDING'").get();
    assert.ok(jobRow);
    assert.ok(jobRow.payload.includes(createdIncidentId));

    // Verify usage record incremented
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const usageRow = db.prepare('SELECT incident_count FROM usage_records WHERE project_id = ? AND billing_period = ?').get(projectId, currentPeriod);
    assert.equal(usageRow.incident_count, 1);
  });

  test('GET /api/v1/incidents lists ingested incidents for project owner', async () => {
    const res = await request(app)
      .get('/api/v1/incidents')
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.incidents.length, 1);
    assert.equal(res.body.data.incidents[0].id, createdIncidentId);
    assert.equal(res.body.data.incidents[0].project_name, 'E-Commerce Storefront');
  });

  test('GET /api/v1/incidents/:id returns full details and telemetry breadcrumbs', async () => {
    const res = await request(app)
      .get(`/api/v1/incidents/${createdIncidentId}`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.incident.id, createdIncidentId);
    assert.equal(res.body.data.incident.telemetry.length, 2);
    assert.equal(res.body.data.incident.telemetry[0].id, 'checkout-btn');
  });

  test('GET /api/v1/incidents/:id succeeds with project x-api-key (CLI/SDK machine access)', async () => {
    const res = await request(app)
      .get(`/api/v1/incidents/${createdIncidentId}`)
      .set('x-api-key', rawApiKey);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.incident.id, createdIncidentId);
  });

  test('PATCH /api/v1/incidents/:id/status updates status to RESOLVED', async () => {
    const res = await request(app)
      .patch(`/api/v1/incidents/${createdIncidentId}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'RESOLVED' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.incident.status, 'RESOLVED');
  });

  test('GET /api/v1/incidents/:id/test-file streams .spec.js file download', async () => {
    const res = await request(app)
      .get(`/api/v1/incidents/${createdIncidentId}/test-file`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('application/javascript'));
    assert.ok(res.headers['content-disposition'].includes('attachment'));
  });

  test('POST /api/v1/incidents/:id/regenerate re-queues AI job', async () => {
    const res = await request(app)
      .post(`/api/v1/incidents/${createdIncidentId}/regenerate`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 202);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.generationStatus, 'PENDING');
  });

  test('POST /api/v1/incidents/:id/create-pr validates repository and token requirement', async () => {
    const res = await request(app)
      .post(`/api/v1/incidents/${createdIncidentId}/create-pr`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.code.includes('GITHUB_REPO_REQUIRED'));
  });

  test('POST /api/v1/incidents/:id/create-pr generates and opens PR on GitHub', async () => {
    const res = await request(app)
      .post(`/api/v1/incidents/${createdIncidentId}/create-pr`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        repo: 'acme-corp/storefront-app',
        token: 'ghp_mock_token_for_automated_testing',
        baseBranch: 'main',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.pullRequestUrl.includes('acme-corp/storefront-app/pull'));
    assert.equal(res.body.data.pullRequestNumber, 101);
    assert.ok(res.body.data.branch.startsWith('bugreplay/repro-'));
  });
});
