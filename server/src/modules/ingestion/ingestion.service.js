import crypto from 'crypto';
import { getDb } from '../../db/db.js';
import { FingerprintService } from '../incidents/fingerprint.service.js';
import { metrics } from '../../services/metrics.service.js';
import { sseService } from '../incidents/sse.service.js';

export class IngestionService {
  static ingestIncident(project, billingPeriod, data) {
    const db = getDb();
    const fingerprint = FingerprintService.computeFingerprint({
      errorType: data.errorType,
      errorMessage: data.errorMessage,
      errorStack: data.errorStack,
      pageUrl: data.pageUrl,
    });

    // Check for existing open incident with identical fingerprint within the last 24h
    const existing = db.prepare(`
      SELECT id, occurrence_count, generation_status
      FROM incidents
      WHERE project_id = ? 
        AND fingerprint = ? 
        AND status = 'OPEN'
        AND created_at >= datetime('now', '-24 hours')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(project.project_id, fingerprint);

    if (existing) {
      // Deduplicate: increment occurrence count and record usage
      const newCount = (existing.occurrence_count || 1) + 1;
      const deviceHealthJson = data.deviceHealth ? JSON.stringify(data.deviceHealth) : null;

      const dedupeTx = db.transaction(() => {
        db.prepare(`
          UPDATE incidents SET
            occurrence_count = ?,
            last_seen_at = CURRENT_TIMESTAMP,
            device_health_json = COALESCE(?, device_health_json)
          WHERE id = ?
        `).run(newCount, deviceHealthJson, existing.id);

        db.prepare(`
          INSERT INTO usage_records (id, project_id, billing_period, incident_count, updated_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(project_id, billing_period) DO UPDATE SET
            incident_count = incident_count + 1,
            updated_at = CURRENT_TIMESTAMP
        `).run(crypto.randomUUID(), project.project_id, billingPeriod);
      });

      dedupeTx();

      metrics.recordIncidentIngested(true);

      // Broadcast real-time recurrence event
      sseService.broadcastToUser(project.user_id, 'incident.deduplicated', {
        incidentId: existing.id,
        projectId: project.project_id,
        occurrenceCount: newCount,
        lastSeenAt: new Date().toISOString(),
      });

      return {
        incidentId: existing.id,
        generationStatus: existing.generation_status,
        isDuplicate: true,
        occurrenceCount: newCount,
      };
    }

    // New distinct incident
    const incidentId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const telemetryJson = JSON.stringify(data.telemetry || []);
    const deviceHealthJson = data.deviceHealth ? JSON.stringify(data.deviceHealth) : null;

    const ingestTx = db.transaction(() => {
      // 1. Insert Incident Record with Fingerprint and Device Health
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
          device_health_json,
          telemetry_json,
          fingerprint,
          occurrence_count,
          last_seen_at,
          status,
          generation_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 'OPEN', 'PENDING')
      `).run(
        incidentId,
        project.project_id,
        data.errorMessage,
        data.errorType,
        data.errorStack,
        data.pageUrl,
        data.userAgent,
        data.viewport,
        deviceHealthJson,
        telemetryJson,
        fingerprint
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
        INSERT INTO jobs (id, type, payload, status, scheduled_at)
        VALUES (?, 'AI_SYNTHESIS', ?, 'PENDING', CURRENT_TIMESTAMP)
      `).run(jobId, JSON.stringify({ incidentId, projectId: project.project_id }));
    });

    ingestTx();

    metrics.recordIncidentIngested(false);

    // Broadcast real-time new incident event
    sseService.broadcastToUser(project.user_id, 'incident.created', {
      incidentId,
      projectId: project.project_id,
      projectName: project.name || 'Application',
      errorMessage: data.errorMessage,
      errorType: data.errorType,
      pageUrl: data.pageUrl,
      timestamp: new Date().toISOString(),
    });

    return {
      incidentId,
      generationStatus: 'PENDING',
      isDuplicate: false,
      occurrenceCount: 1,
    };
  }
}
