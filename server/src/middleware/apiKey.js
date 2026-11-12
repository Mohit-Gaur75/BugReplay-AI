import db from '../db.js';

// Monthly bug capture quotas per subscription tier
const PLAN_QUOTAS = {
  FREE: 50,
  PRO: 1000,
  TEAM: 5000
};

export function requireApiKey(req, res, next) {
  // Support both header and query param (for navigator.sendBeacon)
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized: Missing x-api-key header or apiKey query parameter'
    });
  }

  // Lookup project and its owner's plan tier
  const project = db.prepare(`
    SELECT 
      p.id, 
      p.user_id, 
      p.name, 
      p.api_key, 
      p.allowed_domains,
      u.plan_tier
    FROM projects p
    JOIN users u ON p.user_id = u.id
    WHERE p.api_key = ?
  `).get(apiKey);

  if (!project) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid BugReplay API key'
    });
  }

  // Validate allowed origin/domain if specified
  if (project.allowed_domains && project.allowed_domains !== '*') {
    const origin = req.headers.origin || req.headers.referer || '';
    const allowedList = project.allowed_domains.split(',').map(d => d.trim().toLowerCase());
    const matches = allowedList.some(allowed => origin.toLowerCase().includes(allowed));
    if (origin && !matches) {
      return res.status(403).json({
        error: `Forbidden: Origin ${origin} is not in the allowed domains list for this project`
      });
    }
  }

  // Enforce monthly quota
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const usageCount = db.prepare(`
    SELECT count(*) as count 
    FROM incidents 
    WHERE project_id = ? 
      AND created_at >= ?
  `).get(project.id, currentMonthStart.toISOString());

  const tier = project.plan_tier || 'FREE';
  const monthlyLimit = PLAN_QUOTAS[tier] || PLAN_QUOTAS.FREE;

  if (usageCount.count >= monthlyLimit) {
    return res.status(429).json({
      error: `Plan Quota Exceeded: Your ${tier} plan limit of ${monthlyLimit} bugs/month has been reached. Upgrade to Pro for 1,000 bugs/month at BugReplay AI Settings.`,
      quotaExceeded: true,
      currentUsage: usageCount.count,
      limit: monthlyLimit,
      plan: tier
    });
  }

  req.project = project;
  next();
}
