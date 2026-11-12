import express from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED'])
});

// GET /api/v1/incidents - List incidents across user's projects
router.get('/', requireAuth, (req, res) => {
  const { projectId, status, search, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Build dynamic SQL query scoped to the user's projects
  let whereClauses = ['p.user_id = ?'];
  let params = [req.user.id];

  if (projectId) {
    whereClauses.push('i.project_id = ?');
    params.push(projectId);
  }

  if (status && status !== 'ALL') {
    whereClauses.push('i.status = ?');
    params.push(status);
  }

  if (search) {
    whereClauses.push('(i.error_message LIKE ? OR i.error_type LIKE ? OR i.page_url LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereSQL = whereClauses.join(' AND ');

  const totalCount = db.prepare(`
    SELECT count(i.id) as count
    FROM incidents i
    JOIN projects p ON i.project_id = p.id
    WHERE ${whereSQL}
  `).get(...params).count;

  const incidents = db.prepare(`
    SELECT 
      i.id,
      i.project_id,
      p.name as project_name,
      i.error_message,
      i.error_type,
      i.page_url,
      i.status,
      i.created_at
    FROM incidents i
    JOIN projects p ON i.project_id = p.id
    WHERE ${whereSQL}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  res.json({
    incidents,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1
    }
  });
});

// GET /api/v1/incidents/:id - Get full incident deep dive
router.get('/:id', requireAuth, (req, res) => {
  const incident = db.prepare(`
    SELECT 
      i.*,
      p.name as project_name,
      p.api_key as project_api_key
    FROM incidents i
    JOIN projects p ON i.project_id = p.id
    WHERE i.id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  let parsedTelemetry = [];
  try {
    parsedTelemetry = JSON.parse(incident.telemetry_json);
  } catch (e) {
    parsedTelemetry = [];
  }

  res.json({
    incident: {
      ...incident,
      telemetry: parsedTelemetry
    }
  });
});

// PATCH /api/v1/incidents/:id/status - Update incident status
router.patch('/:id/status', requireAuth, (req, res) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);

    const check = db.prepare(`
      SELECT i.id FROM incidents i
      JOIN projects p ON i.project_id = p.id
      WHERE i.id = ? AND p.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!check) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(status, req.params.id);

    res.json({
      success: true,
      id: req.params.id,
      status,
      message: `Incident status updated to ${status}`
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update incident status' });
  }
});

// GET /api/v1/incidents/:id/test-file - Download .spec.js file
router.get('/:id/test-file', (req, res) => {
  const incident = db.prepare(`
    SELECT id, error_type, generated_playwright_test
    FROM incidents
    WHERE id = ?
  `).get(req.params.id);

  if (!incident || !incident.generated_playwright_test) {
    return res.status(404).send('Playwright test script not found for this incident');
  }

  const filename = `bugreplay-${incident.id}.spec.js`;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(incident.generated_playwright_test);
});

// DELETE /api/v1/incidents/:id - Delete an incident
router.delete('/:id', requireAuth, (req, res) => {
  const check = db.prepare(`
    SELECT i.id FROM incidents i
    JOIN projects p ON i.project_id = p.id
    WHERE i.id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!check) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  db.prepare('DELETE FROM incidents WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Incident deleted successfully' });
});

export default router;
