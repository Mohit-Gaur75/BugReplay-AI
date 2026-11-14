import crypto from 'crypto';
import { getDb } from '../db/db.js';
import { getProjectRole } from '../middleware/rbac.js';

export const AUDIT_ACTIONS = {
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  API_KEY_ROTATED: 'API_KEY_ROTATED',
  MEMBER_INVITED: 'MEMBER_INVITED',
  MEMBER_ROLE_CHANGED: 'MEMBER_ROLE_CHANGED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INCIDENT_STATUS_CHANGED: 'INCIDENT_STATUS_CHANGED',
  INCIDENT_DELETED: 'INCIDENT_DELETED',
  TEST_RUN_DISPATCHED: 'TEST_RUN_DISPATCHED',
  PR_CREATED: 'PR_CREATED',
};

export class AuditService {
  /**
   * Records a security / audit event into the immutable audit_logs store.
   * Fail-safe: errors are logged to stderr and do not interrupt the calling operation.
   */
  static record({
    projectId,
    actorId = null,
    actorEmail = null,
    actorRole = null,
    action,
    targetType = null,
    targetId = null,
    targetName = null,
    details = null,
    ipAddress = null,
    userAgent = null,
    req = null,
  }) {
    if (!projectId || !action) {
      console.warn('[AuditService] Missing required projectId or action for audit log entry');
      return null;
    }

    try {
      const db = getDb();

      // Extract client network and actor metadata from Express req when provided
      let effectiveIp = ipAddress;
      let effectiveUserAgent = userAgent;
      let effectiveActorId = actorId;
      let effectiveActorEmail = actorEmail;
      let effectiveActorRole = actorRole;

      if (req) {
        effectiveIp =
          effectiveIp ||
          req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.ip ||
          req.socket?.remoteAddress ||
          '127.0.0.1';
        effectiveUserAgent = effectiveUserAgent || req.headers?.['user-agent'] || 'BugReplay-Client';

        if (req.user) {
          effectiveActorId = effectiveActorId || req.user.id;
          effectiveActorEmail = effectiveActorEmail || req.user.email;
        }
      }

      // If actor email or role are still unknown but actorId is provided, resolve them
      if (effectiveActorId && (!effectiveActorEmail || !effectiveActorRole)) {
        if (!effectiveActorEmail) {
          const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(effectiveActorId);
          if (userRow) effectiveActorEmail = userRow.email;
        }
        if (!effectiveActorRole) {
          const memberRow = db
            .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
            .get(projectId, effectiveActorId);
          if (memberRow) {
            effectiveActorRole = memberRow.role;
          } else {
            // Check if user is the direct owner
            const proj = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(projectId);
            if (proj && proj.user_id === effectiveActorId) {
              effectiveActorRole = 'OWNER';
            }
          }
        }
      }

      // If actorId is still missing, fallback to project owner for schema integrity
      if (!effectiveActorId && projectId) {
        const proj = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(projectId);
        if (proj) {
          effectiveActorId = proj.user_id;
          if (!effectiveActorRole) effectiveActorRole = 'OWNER';
          if (!effectiveActorEmail) {
            const ownerRow = db.prepare('SELECT email FROM users WHERE id = ?').get(proj.user_id);
            if (ownerRow) effectiveActorEmail = ownerRow.email;
          }
        }
      }

      // Serialize details payload safely
      let serializedDetails = null;
      if (details !== null && details !== undefined) {
        serializedDetails = typeof details === 'string' ? details : JSON.stringify(details);
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO audit_logs (
          id, project_id, user_id, actor_id, actor_email, actor_role,
          action, target_type, target_id, target_name, details,
          ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        projectId,
        effectiveActorId || '00000000-0000-0000-0000-000000000000',
        effectiveActorId || null,
        effectiveActorEmail || 'system@bugreplay.dev',
        effectiveActorRole || 'SYSTEM',
        action,
        targetType || null,
        targetId || null,
        targetName || null,
        serializedDetails,
        effectiveIp || '127.0.0.1',
        effectiveUserAgent || 'BugReplay-Server',
        createdAt
      );

      return {
        id,
        projectId,
        action,
        actorEmail: effectiveActorEmail,
        createdAt,
      };
    } catch (err) {
      console.error('[AuditService.record] Failed to record audit log:', err.message);
      return null;
    }
  }

  /**
   * Retrieves paginated audit logs for a project with optional action, search and date filters.
   */
  static listLogs(callerUserId, projectId, options = {}) {
    const role = getProjectRole(callerUserId, projectId);
    if (!role) {
      const error = new Error('You do not have access to this project');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    if (role === 'VIEWER') {
      const error = new Error('Viewers do not have permission to view enterprise audit logs.');
      error.statusCode = 403;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.isOperational = true;
      throw error;
    }

    const {
      action,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 25,
    } = options;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const db = getDb();
    const whereClauses = ['project_id = ?'];
    const queryParams = [projectId];

    if (action && typeof action === 'string' && action.trim() !== '' && action !== 'ALL') {
      whereClauses.push('action = ?');
      queryParams.push(action.trim());
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      whereClauses.push('(actor_email LIKE ? OR target_name LIKE ? OR details LIKE ?)');
      const wild = `%${search.trim()}%`;
      queryParams.push(wild, wild, wild);
    }

    if (startDate) {
      whereClauses.push('created_at >= ?');
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClauses.push('created_at <= ?');
      queryParams.push(endDate);
    }

    const whereSql = whereClauses.join(' AND ');

    // Count total matching records
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE ${whereSql}`).get(...queryParams);
    const total = countRow ? countRow.count : 0;
    const totalPages = Math.ceil(total / limitNum) || 1;

    // Fetch paginated rows
    const logs = db
      .prepare(`
        SELECT * FROM audit_logs
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams, limitNum, offset);

    // Parse details JSON if present
    const parsedLogs = logs.map((log) => {
      let parsedDetails = null;
      if (log.details) {
        try {
          parsedDetails = JSON.parse(log.details);
        } catch {
          parsedDetails = log.details;
        }
      }
      return {
        ...log,
        details: parsedDetails,
      };
    });

    return {
      logs: parsedLogs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  /**
   * Exports project audit logs in CSV or JSON format for compliance auditing.
   */
  static exportLogs(callerUserId, projectId, format = 'csv', options = {}) {
    const role = getProjectRole(callerUserId, projectId);
    if (!role) {
      const error = new Error('You do not have access to this project');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    if (role === 'VIEWER') {
      const error = new Error('Viewers do not have permission to export enterprise audit logs.');
      error.statusCode = 403;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const whereClauses = ['project_id = ?'];
    const queryParams = [projectId];

    if (options.action && options.action !== 'ALL') {
      whereClauses.push('action = ?');
      queryParams.push(options.action);
    }

    if (options.startDate) {
      whereClauses.push('created_at >= ?');
      queryParams.push(options.startDate);
    }

    if (options.endDate) {
      whereClauses.push('created_at <= ?');
      queryParams.push(options.endDate);
    }

    const whereSql = whereClauses.join(' AND ');

    // Fetch up to 2000 records for export
    const logs = db
      .prepare(`
        SELECT * FROM audit_logs
        WHERE ${whereSql}
        ORDER BY created_at DESC
        LIMIT 2000
      `)
      .all(...queryParams);

    if (format === 'json') {
      const parsedLogs = logs.map((log) => {
        let detailsObj = null;
        if (log.details) {
          try {
            detailsObj = JSON.parse(log.details);
          } catch {
            detailsObj = log.details;
          }
        }
        return { ...log, details: detailsObj };
      });
      return {
        format: 'json',
        contentType: 'application/json',
        filename: `audit-logs-${projectId}.json`,
        data: parsedLogs,
      };
    }

    // Generate CSV string
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      // Double up existing quotes
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Actor Email',
      'Actor Role',
      'Target Type',
      'Target ID',
      'Target Name',
      'IP Address',
      'User Agent',
      'Details',
    ];

    const csvRows = [headers.map(escapeCsv).join(',')];

    for (const log of logs) {
      const row = [
        escapeCsv(log.id),
        escapeCsv(log.created_at),
        escapeCsv(log.action),
        escapeCsv(log.actor_email),
        escapeCsv(log.actor_role),
        escapeCsv(log.target_type),
        escapeCsv(log.target_id),
        escapeCsv(log.target_name),
        escapeCsv(log.ip_address),
        escapeCsv(log.user_agent),
        escapeCsv(log.details),
      ];
      csvRows.push(row.join(','));
    }

    return {
      format: 'csv',
      contentType: 'text/csv',
      filename: `audit-logs-${projectId}-${Date.now()}.csv`,
      data: csvRows.join('\r\n'),
    };
  }

  /**
   * Returns list of distinct actions available for filtering.
   */
  static getDistinctActions(callerUserId, projectId) {
    const role = getProjectRole(callerUserId, projectId);
    if (!role) {
      const error = new Error('You do not have access to this project');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const rows = db
      .prepare('SELECT DISTINCT action FROM audit_logs WHERE project_id = ? ORDER BY action ASC')
      .all(projectId);

    return rows.map((r) => r.action);
  }
}
