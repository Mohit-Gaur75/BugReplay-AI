import crypto from 'crypto';
import { getDb } from '../../db/db.js';

export class IngestionService {
  static ingestIncident(project, billingPeriod, data) {
    const db = getDb();
    const incidentId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    const telemetryJson = JSON.stringify(data.telemetry || []);

    const ingestTx = db.transaction(() => {
      // 1. Insert Incident Record
      db.prepare(`
        INSERT INTO incidents (
          id,
          project_id,
          error_message,
          error_type,
          error_stack,
          page_url,
          user_agent,
          viewport,
          telemetry_json,
          status,
          generation_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'PENDING')
      `).run(
        incidentId,
        project.project_id,
        data.errorMessage,
        data.errorType,
        data.errorStack,
        data.pageUrl,
        data.userAgent,
        data.viewport,
        telemetryJson
      );

      // 2. Upsert Usage Records for the current billing period
      db.prepare(`
        INSERT INTO usage_records (id, project_id, billing_period, incident_count, updated_at)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id, billing_period) DO UPDATE SET
          incident_count = incident_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `).run(crypto.randomUUID(), project.project_id, billingPeriod);

      // 3. Enqueue Durable Background Job for AI Playwright Synthesis
      db.prepare(`
        INSERT INTO jobs (id, type, payload, status)
        VALUES (?, 'AI_SYNTHESIS', ?, 'PENDING')
      `).run(jobId, JSON.stringify({ incidentId, projectId: project.project_id }));
    });

    ingestTx();

    return {
      incidentId,
      generationStatus: 'PENDING',
    };
  }
}
