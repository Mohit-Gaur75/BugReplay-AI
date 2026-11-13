import crypto from 'crypto';
import { getDb } from '../../db/db.js';
import { generateApiKey, hashApiKey } from '../../utils/crypto.js';

const PLAN_PROJECT_LIMITS = {
  FREE: 1,
  PRO: 5,
  TEAM: 100,
};

export class ProjectsService {
  static createProject(userId, userPlanTier, { name, allowed_domains = '*' }) {
    const db = getDb();

    // Check project limit for user plan tier
    const countRow = db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(userId);
    const maxProjects = PLAN_PROJECT_LIMITS[userPlanTier] || 1;

    if (countRow.count >= maxProjects) {
      const error = new Error(`Project limit reached (${maxProjects} maximum for ${userPlanTier} tier). Upgrade to add more projects.`);
      error.statusCode = 403;
      error.code = 'PROJECT_LIMIT_EXCEEDED';
      error.isOperational = true;
      throw error;
    }

    const projectId = crypto.randomUUID();
    const rawApiKey = generateApiKey();
    const apiKeyHash = hashApiKey(rawApiKey);
    const apiKeyPrefix = rawApiKey.slice(0, 16) + '...';

    db.prepare(`
      INSERT INTO projects (id, user_id, name, api_key_hash, api_key_prefix, allowed_domains)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, userId, name, apiKeyHash, apiKeyPrefix, allowed_domains);

    // Return raw key once to developer
    return {
      id: projectId,
      name,
      allowed_domains,
      api_key_prefix: apiKeyPrefix,
      api_key: rawApiKey,
      warning: 'Store this API key securely. It will never be shown again.',
      created_at: new Date().toISOString(),
    };
  }

  static listProjects(userId) {
    const db = getDb();
    const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    const rows = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.api_key_prefix,
        p.allowed_domains,
        p.created_at,
        COUNT(DISTINCT i.id) as incident_count,
        COALESCE(u.incident_count, 0) as monthly_usage
      FROM projects p
      LEFT JOIN incidents i ON i.project_id = p.id
      LEFT JOIN usage_records u ON u.project_id = p.id AND u.billing_period = ?
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(currentPeriod, userId);

    return rows;
  }

  static getProjectById(userId, projectId) {
    const db = getDb();
    const currentPeriod = new Date().toISOString().slice(0, 7);

    const project = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.api_key_prefix,
        p.allowed_domains,
        p.created_at,
        COUNT(DISTINCT i.id) as incident_count,
        COALESCE(u.incident_count, 0) as monthly_usage
      FROM projects p
      LEFT JOIN incidents i ON i.project_id = p.id
      LEFT JOIN usage_records u ON u.project_id = p.id AND u.billing_period = ?
      WHERE p.id = ? AND p.user_id = ?
      GROUP BY p.id
    `).get(currentPeriod, projectId, userId);

    if (!project) {
      const error = new Error('Project not found or you do not have permission to access it.');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    return project;
  }

  static updateProject(userId, projectId, { name, allowed_domains }) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);

    if (!existing) {
      const error = new Error('Project not found or you do not have permission to modify it.');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (allowed_domains !== undefined) {
      updates.push('allowed_domains = ?');
      values.push(allowed_domains);
    }

    if (updates.length > 0) {
      values.push(projectId, userId);
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    }

    return this.getProjectById(userId, projectId);
  }

  static rotateApiKey(userId, projectId) {
    const db = getDb();
    const existing = db.prepare('SELECT id, name FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);

    if (!existing) {
      const error = new Error('Project not found or you do not have permission to rotate its key.');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const rawNewApiKey = generateApiKey();
    const newApiKeyHash = hashApiKey(rawNewApiKey);
    const newApiKeyPrefix = rawNewApiKey.slice(0, 16) + '...';

    const rotateTx = db.transaction(() => {
      db.prepare(`
        UPDATE projects 
        SET api_key_hash = ?, api_key_prefix = ?
        WHERE id = ? AND user_id = ?
      `).run(newApiKeyHash, newApiKeyPrefix, projectId, userId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, details)
        VALUES (?, ?, 'API_KEY_ROTATED', ?)
      `).run(crypto.randomUUID(), userId, JSON.stringify({ projectId, projectName: existing.name }));
    });

    rotateTx();

    return {
      projectId,
      new_api_key: rawNewApiKey,
      new_api_key_prefix: newApiKeyPrefix,
      warning: 'Update your client SDK snippets immediately. The old API key is now revoked.',
    };
  }

  static deleteProject(userId, projectId) {
    const db = getDb();
    const existing = db.prepare('SELECT id, name FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);

    if (!existing) {
      const error = new Error('Project not found or you do not have permission to delete it.');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(projectId, userId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, details)
        VALUES (?, ?, 'PROJECT_DELETED', ?)
      `).run(crypto.randomUUID(), userId, JSON.stringify({ projectId, projectName: existing.name }));
    });

    deleteTx();

    return { id: projectId, deleted: true };
  }
}
