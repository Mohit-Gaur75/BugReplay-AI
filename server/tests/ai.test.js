import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, closeDb } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrations.js';
import { Synthesizer } from '../src/modules/ai/synthesizer.js';
import { processJobsOnce } from '../src/jobs/worker.js';
import { convertToCypress, convertToPuppeteer, convertToRTL, generateGitPatch } from '../../client/src/utils/frameworkConverter.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.resolve(__dirname, 'test_ai.db');

describe('Phase 5: AI & Playwright Synthesis Engine + Durable Queue Worker', () => {
  let app;
  let db;
  let userToken;
  let rawApiKey;

  before(async () => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
    db = initDb(testDbPath);
    runMigrations(db);
    app = createApp();

    // Setup user and project
    const userRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'synthesizer@bugreplay.dev', password: 'Password123!' });
    userToken = userRes.body.data.token;

    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Checkout Frontend' });
    rawApiKey = projRes.body.data.project.api_key;
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  });

  test('Synthesizer generates valid Playwright test code and route mocks deterministically', () => {
    const mockIncident = {
      id: 'inc-12345678-abcd',
      error_message: "Cannot read properties of undefined (reading 'token')",
      error_type: 'TypeError',
      error_stack: 'TypeError: Cannot read properties of undefined (reading \'token\')\n    at onSubmit (pay.js:55)',
      page_url: 'http://localhost:5173/checkout',
      viewport: '1920x1080',
      user_agent: 'Mozilla/5.0 Chrome/120',
    };

    const mockTelemetry = [
      {
        type: 'click',
        tagName: 'BUTTON',
        id: 'submit-order',
        selector: 'button#submit-order',
        innerText: 'Pay Now ($99)',
      },
      {
        type: 'network',
        method: 'POST',
        url: 'http://localhost:5173/api/v1/charge',
        status: 500,
        responseBody: { error: 'Payment gateway timeout', code: 'GATEWAY_504' },
      },
    ];

    const result = Synthesizer.synthesizeHeuristic(mockIncident, mockTelemetry);

    assert.equal(result.confidence, 'RULE_BASED');
    assert.ok(result.rootCause.includes('500'));
    assert.ok(result.playwrightTest.includes("import { test, expect } from '@playwright/test'"));
    assert.ok(result.playwrightTest.includes('page.setViewportSize({ width: 1920, height: 1080 })'));
    assert.ok(result.playwrightTest.includes('page.route('));
    assert.ok(result.playwrightTest.includes('status: 500'));
    assert.ok(result.playwrightTest.includes('GATEWAY_504'));
    assert.ok(result.playwrightTest.includes("button#submit-order"));
    assert.ok(result.playwrightTest.includes('expect(errorIndicator'));
  });

  test('Synthesizer handles allowlisted GraphQL & POST requestBody in route mocking and diagnosis', () => {
    const mockIncident = {
      id: 'inc-graphql-9912',
      error_message: "GraphQL Error: Cart checkout failed",
      error_type: 'GraphQLError',
      error_stack: 'GraphQLError: Cart checkout failed\n    at mutateCart (cart.js:33)',
      page_url: 'http://localhost:5173/shop',
      viewport: '1440x900',
    };

    const mockTelemetry = [
      {
        type: 'network',
        method: 'POST',
        url: 'http://localhost:5173/api/v1/graphql',
        status: 500,
        requestBody: {
          operationName: 'CheckoutCartMutation',
          query: 'mutation CheckoutCartMutation { checkout { id } }',
          variables: { cartId: 'c_123' },
        },
        responseBody: { errors: [{ message: 'Cart expired' }] },
      },
    ];

    const result = Synthesizer.synthesizeHeuristic(mockIncident, mockTelemetry);
    assert.ok(result.playwrightTest.includes('CheckoutCartMutation'));
    assert.ok(result.playwrightTest.includes('Cart expired'));
    assert.ok(result.explanation.includes('CheckoutCartMutation') || result.explanation.includes('operationName'));
  });

  test('Background worker picks up queued job and completes synthesis on incident record', async () => {
    // 1. Ingest incident
    const ingestRes = await request(app)
      .post('/api/v1/ingest')
      .set('x-api-key', rawApiKey)
      .send({
        errorMessage: 'Unhandled Rejection: Network request timed out',
        errorType: 'UnhandledRejection',
        pageUrl: 'http://localhost:5173/demo',
        viewport: '1440x900',
        telemetry: [
          {
            type: 'click',
            tagName: 'BUTTON',
            id: 'checkout-btn',
            selector: 'button#checkout-btn',
            innerText: 'Trigger 500 API Call',
          },
          {
            type: 'network',
            method: 'POST',
            url: '/api/v1/simulate/500',
            status: 500,
            durationMs: 250,
            responseBody: { error: 'Database locked' },
          },
        ],
      });

    assert.equal(ingestRes.status, 202);
    const incidentId = ingestRes.body.incidentId;

    // Verify incident is initially PENDING
    const initialIncident = db.prepare('SELECT generation_status, generated_playwright_test FROM incidents WHERE id = ?').get(incidentId);
    assert.equal(initialIncident.generation_status, 'PENDING');
    assert.equal(initialIncident.generated_playwright_test, null);

    // Verify job in jobs table
    const pendingJob = db.prepare("SELECT * FROM jobs WHERE status = 'PENDING'").get();
    assert.ok(pendingJob);

    // 2. Run worker processor step
    const processed = await processJobsOnce();
    assert.equal(processed, true, 'Worker should process the pending job');

    // 3. Verify job status updated to COMPLETED
    const completedJob = db.prepare('SELECT status, error FROM jobs WHERE id = ?').get(pendingJob.id);
    assert.equal(completedJob.status, 'COMPLETED');
    assert.equal(completedJob.error, null);

    // 4. Verify incident record updated with synthesized Playwright test and AI root cause
    const completedIncident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
    assert.equal(completedIncident.generation_status, 'COMPLETED');
    assert.ok(completedIncident.generated_playwright_test.includes('@playwright/test'));
    assert.ok(completedIncident.generated_playwright_test.includes('button#checkout-btn'));
    assert.ok(completedIncident.generated_playwright_test.includes('Database locked'));
    assert.ok(completedIncident.ai_root_cause_summary);
    assert.ok(completedIncident.suggested_fix);
  });

  test('Framework Converter exports Playwright code to clean Cypress and Puppeteer tests', () => {
    const playwrightCode = `
import { test, expect } from '@playwright/test';

test('reproduce production failure', async ({ page }) => {
  await page.route('http://localhost:5173/api/v1/charge', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Gateway timeout' }),
    });
  });

  await page.goto('http://localhost:5173/checkout');
  await page.click('button#checkout-btn');
});
    `;

    const mockIncident = {
      id: 'abc-12345678-def',
      error_message: 'Payment Gateway Timeout',
      page_url: 'http://localhost:5173/checkout',
    };

    const cypressCode = convertToCypress(playwrightCode, mockIncident);
    assert.ok(cypressCode.includes("describe('BugReplay Incident #abc-1234 Reproduction'"));
    assert.ok(cypressCode.includes("cy.intercept('*/api/v1/charge', {"));
    assert.ok(cypressCode.includes("statusCode: 500"));
    assert.ok(cypressCode.includes("cy.visit('http://localhost:5173/checkout');"));
    assert.ok(cypressCode.includes("cy.get('button#checkout-btn').click();"));

    const puppeteerCode = convertToPuppeteer(playwrightCode, mockIncident);
    assert.ok(puppeteerCode.includes("import puppeteer from 'puppeteer'"));
    assert.ok(puppeteerCode.includes("await page.goto('http://localhost:5173/checkout'"));
    assert.ok(puppeteerCode.includes("await page.click('button#checkout-btn');"));

    const rtlCode = convertToRTL(playwrightCode, mockIncident);
    assert.ok(rtlCode.includes("from '@testing-library/react'"));
    assert.ok(rtlCode.includes("from 'vitest'"));
    assert.ok(rtlCode.includes("vi.stubGlobal('fetch'"));
    assert.ok(rtlCode.includes("Component Crash Reproduction"));

    const gitPatch = generateGitPatch(mockIncident);
    assert.ok(gitPatch.includes("[PATCH] fix: resolve Error in #abc-1234"));
    assert.ok(gitPatch.includes("--- a/src/pages/Checkout.jsx"));
    assert.ok(gitPatch.includes("+++ b/src/pages/Checkout.jsx"));
    assert.ok(gitPatch.includes("if (!response.ok)"));
  });
});
