import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import db from '../db.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { synthesizeTest } from '../services/synthesizer.js';

const router = express.Router();

const ingestPayloadSchema = z.object({
  errorMessage: z.string().min(1, 'Error message is required'),
  errorType: z.string().optional().default('Error'),
  errorStack: z.string().optional().default(''),
  pageUrl: z.string().min(1, 'Page URL is required'),
  userAgent: z.string().optional().default(''),
  viewport: z.string().optional().default('1440x900'),
  telemetry: z.array(z.any()).optional().default([])
});

// POST /api/v1/ingest - Ingestion of telemetry from client SDK
router.post('/', requireApiKey, async (req, res) => {
  try {
    const validated = ingestPayloadSchema.parse(req.body);
    const incidentId = `inc_${crypto.randomUUID()}`;

    // Synthesize Playwright test and root-cause analysis
    const synthesis = await synthesizeTest({
      errorMessage: validated.errorMessage,
      errorType: validated.errorType,
      errorStack: validated.errorStack,
      pageUrl: validated.pageUrl,
      userAgent: validated.userAgent,
      viewport: validated.viewport,
      telemetry: validated.telemetry
    });

    // Insert incident into SQLite
    const insert = db.prepare(`
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
        generated_playwright_test, 
        ai_root_cause_summary, 
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
    `);

    insert.run(
      incidentId,
      req.project.id,
      validated.errorMessage,
      validated.errorType,
      validated.errorStack,
      validated.pageUrl,
      validated.userAgent,
      validated.viewport,
      JSON.stringify(validated.telemetry),
      synthesis.playwrightTest,
      synthesis.rootCauseSummary
    );

    return res.status(201).json({
      success: true,
      incidentId,
      testGenerated: true,
      engine: synthesis.synthesizerEngine,
      message: 'Incident ingested and Playwright test synthesized successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Ingestion error:', err);
    return res.status(500).json({ error: 'Failed to ingest incident and synthesize test' });
  }
});

export default router;
