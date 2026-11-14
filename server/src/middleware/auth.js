import { verifyToken, hashApiKey } from '../utils/crypto.js';
import { errorResponse } from '../utils/response.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { getDb } from '../db/db.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.id) {
      return errorResponse(res, 'Invalid or expired authentication token.', 'UNAUTHORIZED', 401);
    }

    const user = AuthService.getUserById(decoded.id);
    if (!user) {
      return errorResponse(res, 'User session invalid or user no longer exists.', 'UNAUTHORIZED', 401);
    }

    req.user = user;
    return next();
  }

  // Also support authenticating via project API key (x-api-key or ?apiKey=) for CLI / machine access
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (apiKey && typeof apiKey === 'string') {
    const db = getDb();
    const keyHash = hashApiKey(apiKey);
    const project = db.prepare(`
      SELECT p.id as project_id, p.user_id, p.name as project_name, u.plan_tier, u.email
      FROM projects p
      JOIN users u ON u.id = p.user_id
      WHERE p.api_key_hash = ?
    `).get(keyHash);

    if (!project) {
      return errorResponse(res, 'Invalid project API key provided.', 'UNAUTHORIZED', 401);
    }

    req.user = {
      id: project.user_id,
      email: project.email,
      plan_tier: project.plan_tier,
    };
    req.project = project;
    return next();
  }

  return errorResponse(res, 'Authentication required. Missing or invalid Bearer token or API key.', 'UNAUTHORIZED', 401);
}
