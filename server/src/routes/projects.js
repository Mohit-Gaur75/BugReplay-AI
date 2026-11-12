import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  allowed_domains: z.string().optional().default('*')
});

const updatePlanSchema = z.object({
  plan_tier: z.enum(['FREE', 'PRO', 'TEAM'])
});

// GET /api/v1/projects - List projects for logged in user
router.get('/', requireAuth, (req, res) => {
  const projects = db.prepare(`
    SELECT 
      p.id, 
      p.name, 
      p.api_key, 
      p.allowed_domains, 
      p.created_at,
      (SELECT count(*) FROM incidents WHERE project_id = p.id) as incident_count,
      (SELECT count(*) FROM incidents WHERE project_id = p.id AND status = 'OPEN') as open_incidents
    FROM projects p
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.user.id);

  res.json({ projects });
});

// POST /api/v1/projects - Create a new project
router.post('/', requireAuth, (req, res) => {
  try {
    const { name, allowed_domains } = createProjectSchema.parse(req.body);

    const projectId = `prj_${crypto.randomUUID()}`;
    const apiKey = `br_live_${crypto.randomBytes(16).toString('hex')}`;

    const insert = db.prepare(`
      INSERT INTO projects (id, user_id, name, api_key, allowed_domains)
      VALUES (?, ?, ?, ?, ?)
    `);
    insert.run(projectId, req.user.id, name, apiKey, allowed_domains || '*');

    const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.status(201).json({ project: created });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Project creation error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/v1/projects/:id - Get project details
router.get('/:id', requireAuth, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, count(i.id) as incident_count
    FROM projects p
    LEFT JOIN incidents i ON p.id = i.project_id
    WHERE p.id = ? AND p.user_id = ?
    GROUP BY p.id
  `).get(req.params.id, req.user.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({ project });
});

// PATCH /api/v1/projects/plan - Update subscription plan tier
router.patch('/plan', requireAuth, (req, res) => {
  try {
    const { plan_tier } = updatePlanSchema.parse(req.body);

    db.prepare('UPDATE users SET plan_tier = ? WHERE id = ?').run(plan_tier, req.user.id);
    const updatedUser = db.prepare('SELECT id, email, plan_tier FROM users WHERE id = ?').get(req.user.id);

    res.json({
      success: true,
      user: updatedUser,
      message: `Plan upgraded to ${plan_tier} successfully`
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Plan update error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

export default router;
