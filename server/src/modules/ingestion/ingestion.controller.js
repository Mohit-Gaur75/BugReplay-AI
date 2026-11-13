import { IngestionService } from './ingestion.service.js';
import { ingestPayloadSchema } from './ingestion.validation.js';

export class IngestionController {
  static ingest(req, res, next) {
    try {
      const validatedPayload = ingestPayloadSchema.parse(req.body);
      const result = IngestionService.ingestIncident(req.project, req.billingPeriod, validatedPayload);

      return res.status(202).json({
        success: true,
        incidentId: result.incidentId,
        generationStatus: result.generationStatus,
        message: 'Incident ingested and queued for AI Playwright synthesis',
      });
    } catch (err) {
      next(err);
    }
  }
}
