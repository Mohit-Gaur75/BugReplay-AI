import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bugreplay_jwt_super_secret_production_key_2026';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Helper to generate a signed JWT
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, plan_tier: user.plan_tier },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/v1/auth/register
router.post('/register', (req, res) => {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, plan_tier)
      VALUES (?, ?, ?, 'FREE')
    `);
    insertUser.run(userId, email.toLowerCase().trim(), passwordHash);

    // Create a default starter project with an API key
    const projectId = `prj_${crypto.randomUUID()}`;
    const apiKey = `br_live_${crypto.randomBytes(16).toString('hex')}`;

    const insertProject = db.prepare(`
      INSERT INTO projects (id, user_id, name, api_key, allowed_domains)
      VALUES (?, ?, 'My Production App', ?, '*')
    `);
    insertProject.run(projectId, userId, apiKey);

    const user = { id: userId, email: email.toLowerCase().trim(), plan_tier: 'FREE' };
    const token = signToken(user);

    return res.status(201).json({
      token,
      user,
      project: { id: projectId, name: 'My Production App', api_key: apiKey }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = db.prepare('SELECT id, email, password_hash, plan_tier FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        plan_tier: user.plan_tier
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.id, p.name, p.api_key, p.allowed_domains, p.created_at,
      (SELECT count(*) FROM incidents WHERE project_id = p.id) as incident_count
    FROM projects p
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.user.id);

  return res.json({
    user: req.user,
    projects
  });
});

export default router;
