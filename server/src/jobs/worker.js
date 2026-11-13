import { getDb } from '../db/db.js';
import { Synthesizer } from '../modules/ai/synthesizer.js';
import { WebhookNotifier } from '../services/webhookNotifier.js';

let workerInterval = null;

export async function processSingleJob(job) {
  const db = getDb();
  let payload = {};

  try {
    payload = JSON.parse(job.payload);
  } catch (e) {
    db.prepare("UPDATE jobs SET status = 'FAILED', error = 'Malformed payload JSON' WHERE id = ?").run(job.id);
    return;
  }

  const { incidentId } = payload;
  if (!incidentId) {
    db.prepare("UPDATE jobs SET status = 'FAILED', error = 'Missing incidentId in job payload' WHERE id = ?").run(job.id);
    return;
  }

  // Fetch incident
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
  if (!incident) {
    db.prepare("UPDATE jobs SET status = 'FAILED', error = 'Incident not found' WHERE id = ?").run(job.id);
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
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(job.id);
    });

    completeTx();

    // Trigger Webhook Notification if project has webhook_url configured
    try {
      const proj = db.prepare('SELECT name, webhook_url FROM projects WHERE id = ?').get(incident.project_id);
      if (proj && proj.webhook_url) {
        WebhookNotifier.sendIncidentAlert(proj.webhook_url, proj, incident, synthesis).catch(() => {});
      }
    } catch (e) {
      // Non-blocking
    }
  } catch (err) {
    console.error(`[JobWorker] Error processing job ${job.id}:`, err.message);

    const nextRetries = (job.retries || 0) + 1;
    const isExhausted = nextRetries >= 3;

    db.transaction(() => {
      if (isExhausted) {
        db.prepare(`
          UPDATE jobs SET
            status = 'FAILED',
            retries = ?,
            error = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(nextRetries, err.message, job.id);

        db.prepare("UPDATE incidents SET generation_status = 'FAILED' WHERE id = ?").run(incidentId);
      } else {
        db.prepare(`
          UPDATE jobs SET
            status = 'PENDING',
            retries = ?,
            error = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(nextRetries, err.message, job.id);
      }
    })();
  }
}

export async function processJobsOnce() {
  const db = getDb();

  // Find next pending job
  const job = db.prepare(`
    SELECT * FROM jobs 
    WHERE status = 'PENDING' 
    ORDER BY created_at ASC 
    LIMIT 1
  `).get();

  if (!job) {
    return false;
  }

  // Optimistic lock
  const locked = db.prepare(`
    UPDATE jobs 
    SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND status = 'PENDING'
  `).run(job.id);

  if (locked.changes === 0) {
    return false; // Another worker picked it up
  }

  await processSingleJob(job);
  return true;
}

export function startWorker(intervalMs = 2000) {
  if (workerInterval) return;

  workerInterval = setInterval(async () => {
    try {
      await processJobsOnce();
    } catch (err) {
      console.error('[JobWorker] Unhandled polling error:', err);
    }
  }, intervalMs);

  console.log(`✓ Durable SQLite background job worker started (polling every ${intervalMs}ms)`);
}

export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[JobWorker] Background job worker stopped.');
  }
}
