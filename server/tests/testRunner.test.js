import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, closeDb, getDb } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrations.js';
import { TestRunnerService } from '../src/services/testRunner.service.js';
import fs from 'fs';
import crypto from 'crypto';

const TEST_DB_PATH = './data/test_runner.db';

describe('In-Dashboard Playwright Test Runner & Verification Engine', () => {
  let app;
  let db;
  let userToken;
  let otherToken;
  let projectId;
  let incidentId;

  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    db = initDb(TEST_DB_PATH);
    runMigrations(db);
    app = createApp();

    // Register primary user
    const rand = crypto.randomUUID().slice(0, 8);
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `runner_${rand}@bugreplay.dev`, password: 'Password123!' });
    userToken = regRes.body.data.token;

    // Register second user for isolation test
    const regRes2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: `other_${rand}@bugreplay.dev`, password: 'Password123!' });
    otherToken = regRes2.body.data.token;

    // Create project
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Cloud Test Execution Project' });
    projectId = projRes.body.data.project.id;

    // Seed test incident
    incidentId = crypto.randomUUID();
    const playwrightScript = `
import { test, expect } from '@playwright/test';

test('Reproduce Checkout Button Crash', async ({ page }) => {
  await page.goto('http://localhost:3000/checkout');
  await page.click('#pay-btn');
  await expect(page.locator('.error-banner')).toBeVisible();
});
`;

    db.prepare(`
      INSERT INTO incidents (
        id, project_id, error_message, error_type, page_url,
        telemetry_json, generated_playwright_test, status, generation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', 'COMPLETED')
    `).run(
      incidentId,
      projectId,
      'Cannot read property id of undefined',
      'TypeError',
      'http://localhost:3000/checkout',
      JSON.stringify([{ type: 'click', selector: '#pay-btn' }]),
      playwrightScript
    );
  });

  after(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
  });

  test('Migration 005_test_execution_engine adds test_status and test_runs table', () => {
    const tableInfo = db.prepare("PRAGMA table_info('incidents')").all();
    const colNames = tableInfo.map((c) => c.name);

    assert.ok(colNames.includes('test_status'), 'incidents must have test_status column');
    assert.ok(colNames.includes('test_last_run_at'), 'incidents must have test_last_run_at column');
    assert.ok(colNames.includes('test_duration_ms'), 'incidents must have test_duration_ms column');
    assert.ok(colNames.includes('test_logs'), 'incidents must have test_logs column');

    const testRunsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_runs'").get();
    assert.ok(testRunsTable, 'test_runs table must exist');
  });

  test('TestRunnerService executes test, updates incident, and records test_run', async () => {
    const mockRunner = async (incident, specFilePath) => {
      assert.ok(fs.existsSync(specFilePath));
      const content = fs.readFileSync(specFilePath, 'utf8');
      assert.ok(content.includes('Reproduce Checkout Button Crash'));

      return {
        exitCode: 0,
        logs: '[BugReplay Cloud Runner] Running 1 test using 1 worker\n✓ Checkout Button Crash reproduced\n1 passed (1.2s)',
        status: 'PASSED',
      };
    };

    const result = await TestRunnerService.executeTest(incidentId, { mockRunner });

    assert.equal(result.status, 'PASSED');
    assert.equal(result.exitCode, 0);
    assert.ok(result.durationMs >= 0);
    assert.ok(result.logs.includes('1 passed'));

    // Verify database state
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
    assert.equal(incident.test_status, 'PASSED');
    assert.ok(incident.test_last_run_at);
    assert.equal(incident.test_duration_ms, result.durationMs);

    const testRuns = TestRunnerService.getTestRuns(incidentId);
    assert.equal(testRuns.length, 1);
    assert.equal(testRuns[0].status, 'PASSED');
  });

  test('TestRunnerService correctly marks REPRODUCED when Playwright triggers expected error', async () => {
    const mockReproRunner = async () => {
      return {
        exitCode: 1,
        logs: 'Error: expect(received).toBeVisible()\nReceived: hidden\n1 failed (0.8s)',
        status: 'REPRODUCED',
      };
    };

    const result = await TestRunnerService.executeTest(incidentId, { mockRunner: mockReproRunner });

    assert.equal(result.status, 'REPRODUCED');
    assert.equal(result.exitCode, 1);

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
    assert.equal(incident.test_status, 'REPRODUCED');
  });

  test('POST /api/v1/incidents/:id/run-test triggers test execution via API', async () => {
    const res = await request(app)
      .post(`/api/v1/incidents/${incidentId}/run-test`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        simulateStatus: 'PASSED',
        logs: 'Cloud Playwright verified successfully\n1 passed (0.4s)',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'PASSED');
    assert.ok(res.body.data.logs.includes('Cloud Playwright verified'));
  });

  test('GET /api/v1/incidents/:id/test-runs returns history of test executions', async () => {
    const res = await request(app)
      .get(`/api/v1/incidents/${incidentId}/test-runs`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.testRuns));
    assert.ok(res.body.data.testRuns.length >= 3);
  });

  test('GET /api/v1/incidents/:id/test-run/latest returns the most recent test run', async () => {
    const res = await request(app)
      .get(`/api/v1/incidents/${incidentId}/test-run/latest`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.testRun);
    assert.equal(res.body.data.testRun.incident_id, incidentId);
  });

  test('Cross-User Isolation: unauthorized user cannot run or view tests', async () => {
    // Run test attempt
    const runRes = await request(app)
      .post(`/api/v1/incidents/${incidentId}/run-test`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});
    assert.equal(runRes.status, 404);

    // View history attempt
    const viewRes = await request(app)
      .get(`/api/v1/incidents/${incidentId}/test-runs`)
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(viewRes.status, 404);
  });

  test('Rejects running test when incident has no generated Playwright test', async () => {
    const emptyIncidentId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO incidents (
        id, project_id, error_message, page_url, telemetry_json,
        generated_playwright_test, status, generation_status
      ) VALUES (?, ?, 'Empty Test Error', 'http://localhost/empty', '[]', NULL, 'OPEN', 'PENDING')
    `).run(emptyIncidentId, projectId);

    const res = await request(app)
      .post(`/api/v1/incidents/${emptyIncidentId}/run-test`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'NO_SYNTHESIZED_TEST');
  });
});
