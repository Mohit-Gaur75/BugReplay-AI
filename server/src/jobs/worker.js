import crypto from 'crypto';
import { getDb } from '../db/db.js';
import { Synthesizer } from '../modules/ai/synthesizer.js';
import { WebhookNotifier } from '../services/webhookNotifier.js';
import { sseService } from '../modules/incidents/sse.service.js';
import { metrics } from '../services/metrics.service.js';

let workerInterval = null;
const WORKER_ID = `worker_${process.pid}_${crypto.randomUUID().slice(0, 8)}`;
const MAX_CONCURRENT_JOBS = 3;
let activeJobCount = 0;

export async function processSingleJob(job) {
  const db = getDb();
  let payload = {};

  try {
    payload = JSON.parse(job.payload);
  } catch (e) {
    db.prepare("UPDATE jobs SET status = 'FAILED', error = 'Malformed payload JSON' WHERE id = ?").run(job.id);
    metrics.recordSynthesis('FAILED', 'unknown');
    return;
  }

  const { incidentId } = payload;
  if (!incidentId) {
    db.prepare("UPDATE jobs SET status = 'FAILED', error = 'Missing incidentId in job payload' WHERE id = ?").run(job.id);
    metrics.recordSynthesis('FAILED', 'unknown');
    return;
  }

  // Fetch incident
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
  if (!incident) {
    db.prepare("UPDATE jobs SET status = 'FAILED', error = 'Incident not found' WHERE id = ?").run(job.id);
    metrics.recordSynthesis('FAILED', 'unknown');
    return;
  }

  try {
    // Perform AI or Heuristic Synthesis
    const synthesis = await Synthesizer.synthesize(incident);

    // Transactionally update incident and complete job
    const completeTx = db.transaction(() => {
      db.prepare(`
        UPDATE incidents SET
          generated_playwright_test = ?,
          ai_root_cause_summary = ?,
          suggested_fix = ?,
          confidence = ?,
          generation_status = 'COMPLETED'
        WHERE id = ?
      `).run(
        synthesis.playwrightTest,
        synthesis.rootCause,
        synthesis.suggestedFix,
        synthesis.confidence,
        incidentId
      );

      db.prepare(`
        UPDATE jobs SET
          status = 'COMPLETED',
          updated_at = CURRENT_TIMESTAMP,
          locked_at = NULL,
          locked_by = NULL
        WHERE id = ?
      `).run(job.id);
    });

    completeTx();

    // Broadcast real-time synthesis completed event to owner
    try {
      const proj = db.prepare('SELECT user_id, name, webhook_url FROM projects WHERE id = ?').get(incident.project_id);
      if (proj) {
        sseService.broadcastToUser(proj.user_id, 'synthesis.completed', {
          incidentId,
          projectId: incident.project_id,
          projectName: proj.name,
          confidence: synthesis.confidence,
          rootCause: synthesis.rootCause,
        });

        // Trigger Webhook Notification if project has webhook_url configured
        if (proj.webhook_url) {
          WebhookNotifier.sendIncidentAlert(proj.webhook_url, proj, incident, synthesis).catch(() => {});
        }
      }
    } catch (e) {
      // Non-blocking
    }
  } catch (err) {
    console.error(`[JobWorker:${WORKER_ID}] Error processing job ${job.id}:`, err.message);

    const nextRetries = (job.retries || 0) + 1;
    const isExhausted = nextRetries >= 3;
    const backoffSeconds = Math.pow(2, nextRetries) * 5; // 10s, 20s, 40s

    db.transaction(() => {
      if (isExhausted) {
        db.prepare(`
          UPDATE jobs SET
            status = 'FAILED',
            retries = ?,
            error = ?,
            locked_at = NULL,
            locked_by = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(nextRetries, err.message, job.id);

        db.prepare("UPDATE incidents SET generation_status = 'FAILED' WHERE id = ?").run(incidentId);
        metrics.recordSynthesis('FAILED', 'unknown');
      } else {
        db.prepare(`
          UPDATE jobs SET
            status = 'PENDING',
            retries = ?,
            error = ?,
            scheduled_at = datetime('now', '+' || ? || ' seconds'),
            locked_at = NULL,
            locked_by = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(nextRetries, err.message, backoffSeconds, job.id);
      }
    })();
  }
}

/**
 * Acquire and lease the next available job atomically
 */
export function acquireNextJob() {
  const db = getDb();

  // Reclaim stale jobs (workers that died mid-processing > 60s ago) or claim pending scheduled jobs
  const candidate = db.prepare(`
    SELECT * FROM jobs 
    WHERE (status = 'PENDING' OR (status = 'PROCESSING' AND locked_at < datetime('now', '-60 seconds')))
      AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
    ORDER BY created_at ASC 
    LIMIT 1
  `).get();

  if (!candidate) return null;

  // Optimistic lease lock
  const locked = db.prepare(`
    UPDATE jobs 
    SET status = 'PROCESSING',
        locked_at = CURRENT_TIMESTAMP,
        locked_by = ?,
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND (status = 'PENDING' OR (status = 'PROCESSING' AND locked_at < datetime('now', '-60 seconds')))
  `).run(WORKER_ID, candidate.id);

  if (locked.changes === 0) {
    return null; // Another worker claimed it
  }

  return candidate;
}

export async function processJobsOnce() {
  if (activeJobCount >= MAX_CONCURRENT_JOBS) {
    return false;
  }

  const job = acquireNextJob();
  if (!job) {
    return false;
  }

  activeJobCount += 1;
  processSingleJob(job).finally(() => {
    activeJobCount = Math.max(0, activeJobCount - 1);
  });

  return true;
}

export function startWorker(intervalMs = 2000) {
  if (workerInterval) return;

  workerInterval = setInterval(async () => {
    try {
      while (activeJobCount < MAX_CONCURRENT_JOBS) {
        const processed = await processJobsOnce();
        if (!processed) break;
      }
    } catch (err) {
      console.error(`[JobWorker:${WORKER_ID}] Polling error:`, err);
    }
  }, intervalMs);

  console.log(`✓ Durable SQLite background job worker active (Worker ID: ${WORKER_ID}, Max Concurrency: ${MAX_CONCURRENT_JOBS})`);
}

export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log(`[JobWorker:${WORKER_ID}] Background job worker stopped.`);
  }
}
