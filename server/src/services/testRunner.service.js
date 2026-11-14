import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getDb } from '../db/db.js';
import { sseService } from '../modules/incidents/sse.service.js';

export class TestRunnerService {
  /**
   * Execute Playwright test for an incident and record verification telemetry
   */
  static async executeTest(incidentId, options = {}) {
    const db = getDb();
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    if (!incident.generated_playwright_test) {
      throw new Error('Incident has no synthesized Playwright test available to execute');
    }

    const runId = crypto.randomUUID();
    const startTime = Date.now();

    // 1. Record RUNNING status in test_runs and incidents table
    db.transaction(() => {
      db.prepare(`
        INSERT INTO test_runs (id, incident_id, status, created_at)
        VALUES (?, ?, 'RUNNING', CURRENT_TIMESTAMP)
      `).run(runId, incidentId);

      db.prepare(`
        UPDATE incidents SET
          test_status = 'RUNNING',
          test_last_run_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(incidentId);
    })();

    // Broadcast running event
    try {
      const proj = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(incident.project_id);
      if (proj) {
        sseService.broadcastToUser(proj.user_id, 'test_run.started', {
          incidentId,
          runId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Non-blocking
    }

    // 2. Prepare Sandbox Directory
    const tempBaseDir = path.join(os.tmpdir(), 'bugreplay-runs');
    const runDir = path.join(tempBaseDir, runId);

    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    const specFileName = `incident-${incidentId.slice(0, 8)}.spec.js`;
    const specFilePath = path.join(runDir, specFileName);

    fs.writeFileSync(specFilePath, incident.generated_playwright_test, 'utf8');

    let exitCode = 0;
    let fullLogs = '';
    let status = 'PASSED';

    try {
      if (options.simulateStatus) {
        status = options.simulateStatus;
        exitCode = status === 'PASSED' ? 0 : 1;
        fullLogs = options.logs || `[BugReplay Cloud Runner] Executing verification for ${specFileName}...\n✓ Completed with status: ${status}`;
      } else if (options.mockRunner) {
        // Deterministic mock execution for testing/sandbox environments
        const mockResult = await options.mockRunner(incident, specFilePath);
        exitCode = mockResult.exitCode ?? 0;
        fullLogs = mockResult.logs || `[BugReplay Cloud Runner] Executing ${specFileName}...\n✓ All assertions completed.`;
        status = mockResult.status || (exitCode === 0 ? 'PASSED' : 'REPRODUCED');
      } else {
        // Real process execution using npx playwright test
        const result = await this.spawnPlaywright(runDir, specFileName, options.timeoutMs || 25000);
        exitCode = result.exitCode;
        fullLogs = result.logs;

        // Determine verification status
        if (exitCode === 0) {
          status = 'PASSED';
        } else if (fullLogs.includes('Error:') || fullLogs.includes('AssertionError') || fullLogs.includes('failed') || fullLogs.includes('ECONNREFUSED')) {
          status = 'REPRODUCED';
        } else {
          status = 'ERROR';
        }
      }
    } catch (err) {
      exitCode = 1;
      fullLogs += `\n[BugReplay Test Engine Error]: ${err.message}`;
      status = 'ERROR';
    } finally {
      // Clean up temporary sandbox directory
      try {
        if (fs.existsSync(runDir)) {
          fs.rmSync(runDir, { recursive: true, force: true });
        }
      } catch {
        // Best effort cleanup
      }
    }

    const durationMs = Date.now() - startTime;

    // 3. Persist execution results in database
    db.transaction(() => {
      db.prepare(`
        UPDATE test_runs SET
          status = ?,
          exit_code = ?,
          logs = ?,
          duration_ms = ?
        WHERE id = ?
      `).run(status, exitCode, fullLogs, durationMs, runId);

      db.prepare(`
        UPDATE incidents SET
          test_status = ?,
          test_last_run_at = CURRENT_TIMESTAMP,
          test_duration_ms = ?,
          test_logs = ?
        WHERE id = ?
      `).run(status, durationMs, fullLogs, incidentId);
    })();

    // 4. Broadcast test_run.completed via SSE
    try {
      const proj = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(incident.project_id);
      if (proj) {
        sseService.broadcastToUser(proj.user_id, 'test_run.completed', {
          incidentId,
          runId,
          status,
          exitCode,
          durationMs,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Non-blocking
    }

    return {
      runId,
      incidentId,
      status,
      exitCode,
      durationMs,
      logs: fullLogs,
    };
  }

  /**
   * Spawns Playwright test process inside sandbox directory
   */
  static spawnPlaywright(cwd, specFileName, timeoutMs = 25000) {
    return new Promise((resolve) => {
      let logs = `[BugReplay Cloud Runner] Initializing Headless Chromium...\n[BugReplay Cloud Runner] Executing Playwright spec: ${specFileName}\n\n`;

      const cmd = `npx playwright test "${specFileName}" --reporter=list`;
      const child = spawn(cmd, {
        cwd,
        shell: true,
        env: {
          ...process.env,
          CI: '1',
          FORCE_COLOR: '0',
        },
      });

      let killed = false;
      const timer = setTimeout(() => {
        killed = true;
        child.kill();
        logs += `\n⚠️ [Timeout Error] Playwright execution exceeded ${timeoutMs / 1000}s limit. Terminated.`;
        resolve({ exitCode: 124, logs });
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        logs += data.toString();
      });

      child.stderr?.on('data', (data) => {
        logs += data.toString();
      });

      child.on('error', (err) => {
        if (!killed) {
          clearTimeout(timer);
          logs += `\n[Process Error] Could not spawn playwright process: ${err.message}`;
          resolve({ exitCode: 1, logs });
        }
      });

      child.on('close', (code) => {
        if (!killed) {
          clearTimeout(timer);
          logs += `\n[BugReplay Cloud Runner] Execution finished with exit code ${code ?? 0}.`;
          resolve({ exitCode: code ?? 0, logs });
        }
      });
    });
  }

  /**
   * Fetch all test runs for an incident
   */
  static getTestRuns(incidentId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM test_runs
      WHERE incident_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(incidentId);
  }

  /**
   * Fetch latest test run for an incident
   */
  static getLatestTestRun(incidentId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM test_runs
      WHERE incident_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(incidentId);
  }
}
