import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import db from '../src/db.js';
import { synthesizeTest } from '../src/services/synthesizer.js';

let serverInstance;
let baseUrl;
let authToken;
let demoApiKey = 'br_live_demo_1234567890abcdef';
let createdIncidentId;

before(async () => {
  // Start server on an ephemeral port for testing
  await new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const port = serverInstance.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
});

describe('1. Health Check Endpoint', () => {
  test('GET /health returns 200 OK and service status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'BugReplay AI Ingestion & Synthesis Engine');
  });
});

describe('2. Authentication Flow', () => {
  test('POST /api/v1/auth/login succeeds with valid seed credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@bugreplay.dev',
        password: 'password123'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user.email, 'demo@bugreplay.dev');
    authToken = data.token;
  });

  test('POST /api/v1/auth/login rejects invalid credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@bugreplay.dev',
        password: 'wrong_password'
      })
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Invalid email or password/);
  });

  test('GET /api/v1/auth/me returns current user and project list', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.email, 'demo@bugreplay.dev');
    assert.ok(Array.isArray(data.projects));
    assert.ok(data.projects.length >= 1);
  });
});

describe('3. Playwright Synthesis Engine', () => {
  test('Synthesizes valid Playwright test with route mocking and user clicks', async () => {
    const mockTelemetry = [
      {
        type: 'click',
        timestamp: Date.now() - 5000,
        tagName: 'BUTTON',
        id: 'btn-checkout',
        selector: 'button#btn-checkout',
        innerText: 'Pay Now ($99.00)'
      },
      {
        type: 'network',
        timestamp: Date.now() - 2000,
        method: 'POST',
        url: '/api/v1/orders/charge',
        status: 500,
        durationMs: 340,
        responseBody: { error: 'Insufficient inventory' }
      }
    ];

    const result = await synthesizeTest({
      errorMessage: 'Unhandled rejection on order charge',
      errorType: 'NetworkError',
      errorStack: 'NetworkError: Failed to fetch\n    at charge (checkout.js:90:5)',
      pageUrl: 'http://localhost:5173/demo',
      viewport: '1440x900',
      telemetry: mockTelemetry
    });

    assert.ok(result.playwrightTest);
    assert.ok(result.rootCauseSummary);
    assert.match(result.playwrightTest, /import { test, expect } from '@playwright\/test';/);
    assert.match(result.playwrightTest, /page\.route/);
    assert.match(result.playwrightTest, /button#btn-checkout/);
    assert.match(result.playwrightTest, /page\.goto\('http:\/\/localhost:5173\/demo'\)/);
    assert.match(result.rootCauseSummary, /Insufficient inventory|HTTP 500|NetworkError/i);
  });
});

describe('4. Telemetry Ingestion Endpoint', () => {
  test('POST /api/v1/ingest rejects request with missing or invalid API key', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'br_live_invalid_key_99999'
      },
      body: JSON.stringify({
        errorMessage: 'Test error',
        pageUrl: 'http://localhost:5173/demo'
      })
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Invalid BugReplay API key/);
  });

  test('POST /api/v1/ingest accepts valid telemetry, saves incident, and generates Playwright test', async () => {
    const telemetry = [
      {
        type: 'click',
        timestamp: Date.now() - 3000,
        tagName: 'BUTTON',
        id: 'btn-broken-checkout',
        selector: 'button#btn-broken-checkout',
        innerText: 'Trigger Broken Checkout'
      },
      {
        type: 'network',
        timestamp: Date.now() - 1000,
        method: 'POST',
        url: '/api/v1/cart/checkout',
        status: 500,
        durationMs: 250,
        responseBody: { error: 'Database transaction lock timeout' }
      }
    ];

    const res = await fetch(`${baseUrl}/api/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': demoApiKey
      },
      body: JSON.stringify({
        errorMessage: 'TypeError: Cannot read properties of undefined (reading \'discount\')',
        errorType: 'TypeError',
        errorStack: 'TypeError: Cannot read properties of undefined\n    at applyDiscount (checkout.js:45)',
        pageUrl: 'http://localhost:5173/demo',
        viewport: '1440x900',
        telemetry
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.testGenerated, true);
    assert.ok(data.incidentId);
    createdIncidentId = data.incidentId;
  });
});

describe('5. Incidents Retrieval & Lifecycle Management', () => {
  test('GET /api/v1/incidents lists seeded and newly ingested incidents', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.incidents));
    assert.ok(data.incidents.length >= 3);
  });

  test('GET /api/v1/incidents/:id returns full incident deep dive with Playwright script', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents/${createdIncidentId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.incident.id, createdIncidentId);
    assert.ok(data.incident.generated_playwright_test);
    assert.match(data.incident.generated_playwright_test, /import { test, expect }/);
    assert.ok(data.incident.ai_root_cause_summary);
    assert.ok(Array.isArray(data.incident.telemetry));
  });

  test('PATCH /api/v1/incidents/:id/status updates status to RESOLVED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents/${createdIncidentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'RESOLVED' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'RESOLVED');
  });

  test('GET /api/v1/incidents/:id/test-file streams downloadable .spec.js Playwright file', async () => {
    const res = await fetch(`${baseUrl}/api/v1/incidents/${createdIncidentId}/test-file`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/javascript/);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="bugreplay-inc_/);
    const text = await res.text();
    assert.match(text, /import { test, expect } from '@playwright\/test';/);
  });
});
