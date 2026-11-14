import { getDb } from '../db/db.js';
import { errorResponse } from '../utils/response.js';

export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
};

export const ROLE_RANKS = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/**
 * Resolves the effective role of a user in a given project
 */
export function getProjectRole(userId, projectId) {
  if (!userId || !projectId) return null;
  const db = getDb();

  // 1. Check direct membership
  const member = db.prepare(`
    SELECT role FROM project_members
    WHERE project_id = ? AND user_id = ?
  `).get(projectId, userId);

  if (member) return member.role;

  // 2. Fallback: check if user is original creator of the project
  const project = db.prepare(`
    SELECT user_id FROM projects WHERE id = ?
  `).get(projectId);

  if (project && project.user_id === userId) {
    return ROLES.OWNER;
  }

  return null;
}

/**
 * Express middleware requiring a minimum role rank in the target project
 */
export function requireProjectRole(minRole = ROLES.VIEWER) {
  return function rbacMiddleware(req, res, next) {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    let projectId = req.params.projectId || req.params.id || req.body?.projectId || req.query?.projectId;

    // If this route is on an incident (e.g., /incidents/:id/run-test), resolve project_id from incident
    if (req.baseUrl?.includes('incidents') && req.params.id) {
      const db = getDb();
      const inc = db.prepare('SELECT project_id FROM incidents WHERE id = ?').get(req.params.id);
      if (inc) {
        projectId = inc.project_id;
      }
    }

    if (!projectId) {
      return errorResponse(res, 'Project context missing', 400, 'MISSING_PROJECT_ID');
    }

    const userRole = getProjectRole(userId, projectId);
    if (!userRole) {
      return errorResponse(res, 'Project not found or you do not have permission to access it', 404, 'PROJECT_NOT_FOUND');
    }

    const userRank = ROLE_RANKS[userRole] || 0;
    const requiredRank = ROLE_RANKS[minRole] || 1;

    if (userRank < requiredRank) {
      return errorResponse(
        res,
        `Insufficient permissions. Requires at least '${minRole}' role (your current role is '${userRole}').`,
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
    }

    req.projectRole = userRole;
    req.projectId = projectId;
    next();
  };
}
