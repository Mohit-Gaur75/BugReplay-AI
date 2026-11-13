import crypto from 'crypto';
import { getDb } from '../../db/db.js';

export class IncidentsService {
  static listIncidents(userId, { projectId, status, search, page = 1, limit = 20 }) {
    const db = getDb();
    const offset = (Math.max(1, page) - 1) * limit;

    const whereClauses = ['p.user_id = ?'];
    const params = [userId];

    if (projectId) {
      whereClauses.push('i.project_id = ?');
      params.push(projectId);
    }

    if (status && ['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED'].includes(status.toUpperCase())) {
      whereClauses.push('i.status = ?');
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      whereClauses.push('(i.error_message LIKE ? OR i.page_url LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    const whereSql = whereClauses.join(' AND ');

    // Total Count
    const countRow = db.prepare(`
      SELECT COUNT(*) as total 
      FROM incidents i
      JOIN projects p ON p.id = i.project_id
      WHERE ${whereSql}
    `).get(...params);

    const total = countRow ? countRow.total : 0;

    // Paginated Items
    const rows = db.prepare(`
      SELECT 
        i.id,
        i.project_id,
        p.name as project_name,
        i.error_message,
        i.error_type,
        i.page_url,
        i.viewport,
        i.user_agent,
        i.status,
        i.generation_status,
        i.confidence,
        i.created_at
      FROM incidents i
      JOIN projects p ON p.id = i.project_id
      WHERE ${whereSql}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      incidents: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static getIncidentById(userId, incidentId) {
    const db = getDb();

    const row = db.prepare(`
      SELECT 
        i.*,
        p.name as project_name,
        p.allowed_domains
      FROM incidents i
      JOIN projects p ON p.id = i.project_id
      WHERE i.id = ? AND p.user_id = ?
    `).get(incidentId, userId);

    if (!row) {
      const error = new Error('Incident not found or you do not have permission to access it.');
      error.statusCode = 404;
      error.code = 'INCIDENT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    let telemetry = [];
    try {
      telemetry = JSON.parse(row.telemetry_json || '[]');
    } catch (e) {}

    return {
      ...row,
      telemetry,
    };
  }

  static updateStatus(userId, incidentId, status) {
    const validStatuses = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED'];
    const upperStatus = (status || '').toUpperCase();

    if (!validStatuses.includes(upperStatus)) {
      const error = new Error(`Invalid status. Allowed values: ${validStatuses.join(', ')}`);
      error.statusCode = 400;
      error.code = 'INVALID_STATUS';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const existing = db.prepare(`
      SELECT i.id FROM incidents i
      JOIN projects p ON p.id = i.project_id
      WHERE i.id = ? AND p.user_id = ?
    `).get(incidentId, userId);

    if (!existing) {
      const error = new Error('Incident not found or you do not have permission to update it.');
      error.statusCode = 404;
      error.code = 'INCIDENT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(upperStatus, incidentId);

    return this.getIncidentById(userId, incidentId);
  }

  static regenerate(userId, incidentId) {
    const db = getDb();
    const existing = db.prepare(`
      SELECT i.id, i.project_id FROM incidents i
      JOIN projects p ON p.id = i.project_id
      WHERE i.id = ? AND p.user_id = ?
    `).get(incidentId, userId);

    if (!existing) {
      const error = new Error('Incident not found or you do not have permission to regenerate it.');
      error.statusCode = 404;
      error.code = 'INCIDENT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const reTx = db.transaction(() => {
      db.prepare("UPDATE incidents SET generation_status = 'PENDING' WHERE id = ?").run(incidentId);
      db.prepare(`
        INSERT INTO jobs (id, type, payload, status)
        VALUES (?, 'AI_SYNTHESIS', ?, 'PENDING')
      `).run(crypto.randomUUID(), JSON.stringify({ incidentId, projectId: existing.project_id }));
    });

    reTx();

    return { id: incidentId, generationStatus: 'PENDING' };
  }

  static deleteIncident(userId, incidentId) {
    const db = getDb();
    const existing = db.prepare(`
      SELECT i.id FROM incidents i
      JOIN projects p ON p.id = i.project_id
      WHERE i.id = ? AND p.user_id = ?
    `).get(incidentId, userId);

    if (!existing) {
      const error = new Error('Incident not found or you do not have permission to delete it.');
      error.statusCode = 404;
      error.code = 'INCIDENT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    db.prepare('DELETE FROM incidents WHERE id = ?').run(incidentId);

    return { id: incidentId, deleted: true };
  }
}
