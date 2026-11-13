import { getDb } from '../db/db.js';
import { hashApiKey } from '../utils/crypto.js';
import { errorResponse } from '../utils/response.js';

const PLAN_MONTHLY_QUOTAS = {
  FREE: 50,
  PRO: 1000,
  TEAM: 5000,
};

export function requireApiKey(req, res, next) {
  const rawApiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!rawApiKey || typeof rawApiKey !== 'string') {
    return errorResponse(res, 'Missing project API key. Provide via x-api-key header or apiKey query parameter.', 'MISSING_API_KEY', 401);
  }

  const db = getDb();
  const keyHash = hashApiKey(rawApiKey);

  // Find project and join user plan tier
  const project = db.prepare(`
    SELECT 
      p.id as project_id,
      p.user_id,
      p.name as project_name,
      p.allowed_domains,
      u.plan_tier
    FROM projects p
    JOIN users u ON u.id = p.user_id
    WHERE p.api_key_hash = ?
  `).get(keyHash);

  if (!project) {
    return errorResponse(res, 'Invalid API key. Project not found or key revoked.', 'INVALID_API_KEY', 401);
  }

  // Domain Verification (if configured)
  const allowed = project.allowed_domains;
  if (allowed && allowed !== '*') {
    const origin = req.headers.origin || req.headers.referer || '';
    const allowedList = allowed.split(',').map((d) => d.trim().toLowerCase());
    
    // Check if origin matches allowed domain
    const isDomainAllowed = allowedList.some((domain) => {
      if (!domain) return false;
      return origin.toLowerCase().includes(domain.replace(/^https?:\/\//, ''));
    });

    if (origin && !isDomainAllowed) {
      return errorResponse(res, `Origin '${origin}' not permitted by project domain restrictions.`, 'DOMAIN_NOT_ALLOWED', 403);
    }
  }

  // Quota Verification
  const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const usage = db.prepare(`
    SELECT incident_count FROM usage_records 
    WHERE project_id = ? AND billing_period = ?
  `).get(project.project_id, currentPeriod);

  const currentCount = usage ? usage.incident_count : 0;
  const maxQuota = PLAN_MONTHLY_QUOTAS[project.plan_tier] || 50;

  if (currentCount >= maxQuota) {
    return errorResponse(
      res,
      `Monthly incident quota reached (${maxQuota} incidents for ${project.plan_tier} tier). Please upgrade your plan in settings.`,
      'QUOTA_EXCEEDED',
      429
    );
  }

  req.project = project;
  req.billingPeriod = currentPeriod;
  next();
}
