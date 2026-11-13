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
const testDbPath = path.resolve(__dirname, 'test_auth.db');

describe('Feature 2.1: Authentication & Authorization Flow', () => {
  let app;
  let db;

  before(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
    db = initDb(testDbPath);
    runMigrations(db);
    app = createApp();
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  const testUser = {
    email: 'engineer@bugreplay.dev',
    password: 'SuperSecretPassword123!',
  };

  let authToken = null;

  test('POST /api/v1/auth/register creates user and returns JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'Must return JWT token');
    assert.equal(res.body.data.user.email, testUser.email);
    assert.equal(res.body.data.user.plan_tier, 'FREE');
    assert.ok(res.body.data.user.id);
  });

  test('POST /api/v1/auth/register rejects duplicate email with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  test('POST /api/v1/auth/register rejects invalid inputs with 400 Validation Error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: '123' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.length >= 2);
  });

  test('POST /api/v1/auth/login succeeds with correct password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(testUser);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.email, testUser.email);

    authToken = res.body.data.token;
  });

  test('POST /api/v1/auth/login rejects incorrect password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword456!' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('POST /api/v1/auth/login rejects non-existent user with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@bugreplay.dev', password: 'Password123!' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('GET /api/v1/auth/me returns current user context with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, testUser.email);
    assert.equal(res.body.data.user.plan_tier, 'FREE');
  });

  test('GET /api/v1/auth/me rejects requests without token with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/v1/auth/me rejects requests with invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.payload');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  test('POST /api/v1/auth/logout succeeds', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
