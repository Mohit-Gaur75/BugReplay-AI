import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
process.env.NODE_ENV = 'test';
import { createApp } from '../src/app.js';
import { initDb, closeDb } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrations.js';
import { hashApiKey } from '../src/utils/crypto.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.resolve(__dirname, 'test_projects.db');

describe('Feature 2.2: Projects & Cryptographic API Key Management', () => {
  let app;
  let db;
  let aliceToken;
  let bobToken;
  let aliceProjectId;
  let aliceRawApiKey;

  before(async () => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
    db = initDb(testDbPath);
    runMigrations(db);
    app = createApp();

    // Register Alice (User 1)
    const aliceRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'alice@bugreplay.dev', password: 'Password123!' });
    aliceToken = aliceRes.body.data.token;

    // Register Bob (User 2)
    const bobRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bob@bugreplay.dev', password: 'Password123!' });
    bobToken = bobRes.body.data.token;
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  test('POST /api/v1/projects creates project and returns raw API key once', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Alice SaaS App', allowed_domains: 'https://alice.app' });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.project.id);
    assert.equal(res.body.data.project.name, 'Alice SaaS App');
    assert.ok(res.body.data.project.api_key.startsWith('br_live_'));
    assert.ok(res.body.data.project.warning);

    aliceProjectId = res.body.data.project.id;
    aliceRawApiKey = res.body.data.project.api_key;

    // Verify in database that ONLY the SHA-256 hash was stored
    const row = db.prepare('SELECT api_key_hash, api_key_prefix FROM projects WHERE id = ?').get(aliceProjectId);
    assert.equal(row.api_key_hash, hashApiKey(aliceRawApiKey));
    assert.notEqual(row.api_key_hash, aliceRawApiKey, 'Plaintext API key must never be stored in database');
  });

  test('POST /api/v1/projects enforces plan project quota (1 project for FREE)', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Alice Second App' });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'PROJECT_LIMIT_EXCEEDED');
  });

  test('GET /api/v1/projects lists projects with prefix and without raw key', async () => {
    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${aliceToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.projects.length, 1);
    assert.equal(res.body.data.projects[0].id, aliceProjectId);
    assert.equal(res.body.data.projects[0].name, 'Alice SaaS App');
    assert.ok(res.body.data.projects[0].api_key_prefix.startsWith('br_live_'));
    assert.equal(res.body.data.projects[0].api_key, undefined, 'Raw API key must not be exposed in listings');
  });

  test('Cross-User Isolation: Bob cannot access Alice project', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${aliceProjectId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'PROJECT_NOT_FOUND');
  });

  test('PATCH /api/v1/projects/:id updates project details including webhook_url', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${aliceProjectId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ 
        name: 'Alice SaaS App (Renamed)', 
        allowed_domains: '*',
        webhook_url: 'https://hooks.slack.com/services/T000/B000/XXXX'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.project.name, 'Alice SaaS App (Renamed)');
    assert.equal(res.body.data.project.allowed_domains, '*');
    assert.equal(res.body.data.project.webhook_url, 'https://hooks.slack.com/services/T000/B000/XXXX');
  });

  test('POST /api/v1/projects/:id/test-webhook validates permission and dispatches test alert', async () => {
    // Bob should get 404 for Alice's project
    const bobRes = await request(app)
      .post(`/api/v1/projects/${aliceProjectId}/test-webhook`)
      .set('Authorization', `Bearer ${bobToken}`);

    assert.equal(bobRes.status, 404);
    assert.equal(bobRes.body.error.code, 'PROJECT_NOT_FOUND');

    // Alice testing with configured webhook (WebhookNotifier will attempt or mock gracefully)
    const aliceRes = await request(app)
      .post(`/api/v1/projects/${aliceProjectId}/test-webhook`)
      .set('Authorization', `Bearer ${aliceToken}`);

    assert.equal(aliceRes.status, 200);
    assert.equal(aliceRes.body.success, true);
    assert.ok(aliceRes.body.data.sent_at);
  });

  test('POST /api/v1/projects/:id/test-webhook fails if webhook_url is null', async () => {
    // Temporarily clear webhook_url
    await request(app)
      .patch(`/api/v1/projects/${aliceProjectId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ webhook_url: '' });

    const res = await request(app)
      .post(`/api/v1/projects/${aliceProjectId}/test-webhook`)
      .set('Authorization', `Bearer ${aliceToken}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'WEBHOOK_NOT_CONFIGURED');
  });

  test('POST /api/v1/projects/:id/rotate-key generates new key and invalidates old hash', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${aliceProjectId}/rotate-key`)
      .set('Authorization', `Bearer ${aliceToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.new_api_key.startsWith('br_live_'));
    assert.notEqual(res.body.data.new_api_key, aliceRawApiKey);

    // Database must hold new hash
    const row = db.prepare('SELECT api_key_hash FROM projects WHERE id = ?').get(aliceProjectId);
    assert.equal(row.api_key_hash, hashApiKey(res.body.data.new_api_key));
    assert.notEqual(row.api_key_hash, hashApiKey(aliceRawApiKey));
  });

  test('DELETE /api/v1/projects/:id deletes project', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${aliceProjectId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const check = db.prepare('SELECT id FROM projects WHERE id = ?').get(aliceProjectId);
    assert.equal(check, undefined);
  });
});
