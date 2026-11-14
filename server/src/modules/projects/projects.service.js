import crypto from 'crypto';
import { getDb } from '../../db/db.js';
import { generateApiKey, hashApiKey } from '../../utils/crypto.js';
import { WebhookNotifier } from '../../services/webhookNotifier.js';
import { ROLES, ROLE_RANKS, getProjectRole } from '../../middleware/rbac.js';

const PLAN_PROJECT_LIMITS = {
  FREE: 1,
  PRO: 5,
  TEAM: 100,
};

export class ProjectsService {
  static createProject(userId, userPlanTier, { name, allowed_domains = '*', webhook_url = null, github_repo = null, github_token = null }) {
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

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, user_id, name, api_key_hash, api_key_prefix, allowed_domains, webhook_url, github_repo, github_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, userId, name, apiKeyHash, apiKeyPrefix, allowed_domains, webhook_url || null, github_repo || null, github_token || null);

      db.prepare(`
        INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, created_at)
        VALUES (?, ?, ?, 'OWNER', CURRENT_TIMESTAMP)
      `).run(crypto.randomUUID(), projectId, userId);
    });

    insertTx();

    // Return raw key once to developer
    return {
      id: projectId,
      name,
      allowed_domains,
      webhook_url,
      github_repo,
      has_github_token: !!github_token,
      api_key_prefix: apiKeyPrefix,
      api_key: rawApiKey,
      user_role: 'OWNER',
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
        p.webhook_url,
        p.github_repo,
        CASE WHEN p.github_token IS NOT NULL THEN 1 ELSE 0 END as has_github_token,
        p.created_at,
        COALESCE(pm.role, CASE WHEN p.user_id = ? THEN 'OWNER' ELSE 'MEMBER' END) as user_role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        COUNT(DISTINCT i.id) as incident_count,
        COALESCE(u.incident_count, 0) as monthly_usage
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      LEFT JOIN incidents i ON i.project_id = p.id
      LEFT JOIN usage_records u ON u.project_id = p.id AND u.billing_period = ?
      WHERE p.user_id = ? OR pm.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(userId, userId, currentPeriod, userId, userId);

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
        p.webhook_url,
        p.github_repo,
        CASE WHEN p.github_token IS NOT NULL THEN 1 ELSE 0 END as has_github_token,
        p.created_at,
        COALESCE(pm.role, CASE WHEN p.user_id = ? THEN 'OWNER' ELSE 'MEMBER' END) as user_role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        COUNT(DISTINCT i.id) as incident_count,
        COALESCE(u.incident_count, 0) as monthly_usage
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      LEFT JOIN incidents i ON i.project_id = p.id
      LEFT JOIN usage_records u ON u.project_id = p.id AND u.billing_period = ?
      WHERE p.id = ? AND (p.user_id = ? OR pm.user_id = ?)
      GROUP BY p.id
    `).get(userId, userId, currentPeriod, projectId, userId, userId);

    if (!project) {
      const error = new Error('Project not found or you do not have permission to access it.');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    return project;
  }

  static updateProject(userId, projectId, { name, allowed_domains, webhook_url, github_repo, github_token }) {
    const role = getProjectRole(userId, projectId);
    if (!role || ROLE_RANKS[role] < ROLE_RANKS.ADMIN) {
      const error = new Error('Project not found or you do not have permission to modify it.');
      error.statusCode = role ? 403 : 404;
      error.code = role ? 'INSUFFICIENT_PERMISSIONS' : 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
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
    if (webhook_url !== undefined) {
      updates.push('webhook_url = ?');
      values.push(webhook_url || null);
    }
    if (github_repo !== undefined) {
      updates.push('github_repo = ?');
      values.push(github_repo || null);
    }
    if (github_token !== undefined) {
      updates.push('github_token = ?');
      values.push(github_token || null);
    }

    if (updates.length > 0) {
      values.push(projectId);
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getProjectById(userId, projectId);
  }

  static async testWebhook(userId, projectId) {
    const project = this.getProjectById(userId, projectId);
    if (!project.webhook_url) {
      const error = new Error('Project does not have a webhook URL configured.');
      error.statusCode = 400;
      error.code = 'WEBHOOK_NOT_CONFIGURED';
      error.isOperational = true;
      throw error;
    }

    try {
      await WebhookNotifier.sendTestAlert(project.webhook_url, project.name);
    } catch (err) {
      const error = new Error(`Webhook delivery failed: ${err.message}`);
      error.statusCode = 502;
      error.code = 'WEBHOOK_DELIVERY_FAILED';
      error.isOperational = true;
      throw error;
    }

    return { 
      success: true, 
      sent_at: new Date().toISOString(),
      message: 'Test webhook notification delivered successfully.' 
    };
  }

  static rotateApiKey(userId, projectId) {
    const role = getProjectRole(userId, projectId);
    if (!role || ROLE_RANKS[role] < ROLE_RANKS.ADMIN) {
      const error = new Error('Project not found or you do not have permission to rotate its key.');
      error.statusCode = role ? 403 : 404;
      error.code = role ? 'INSUFFICIENT_PERMISSIONS' : 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId);

    const rawNewApiKey = generateApiKey();
    const newApiKeyHash = hashApiKey(rawNewApiKey);
    const newApiKeyPrefix = rawNewApiKey.slice(0, 16) + '...';

    const rotateTx = db.transaction(() => {
      db.prepare(`
        UPDATE projects 
        SET api_key_hash = ?, api_key_prefix = ?
        WHERE id = ?
      `).run(newApiKeyHash, newApiKeyPrefix, projectId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, details)
        VALUES (?, ?, 'API_KEY_ROTATED', ?)
      `).run(crypto.randomUUID(), userId, JSON.stringify({ projectId, projectName: existing?.name }));
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
    const role = getProjectRole(userId, projectId);
    if (!role || role !== ROLES.OWNER) {
      const error = new Error('Only the project owner can delete this project.');
      error.statusCode = role ? 403 : 404;
      error.code = role ? 'INSUFFICIENT_PERMISSIONS' : 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId);

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, details)
        VALUES (?, ?, 'PROJECT_DELETED', ?)
      `).run(crypto.randomUUID(), userId, JSON.stringify({ projectId, projectName: existing?.name }));
    });

    deleteTx();

    return { id: projectId, deleted: true };
  }
}
