import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, closeDb, getDb } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrations.js';
import { AuditService, AUDIT_ACTIONS } from '../src/services/audit.service.js';
import { ProjectsService } from '../src/modules/projects/projects.service.js';
import { TeamsService } from '../src/modules/projects/teams.service.js';
import { IncidentsService } from '../src/modules/incidents/incidents.service.js';
import fs from 'fs';
import crypto from 'crypto';

const TEST_DB_PATH = './data/test_audit.db';

describe('Enterprise Audit Logs & Compliance Trail', () => {
  let app;
  let db;

  let ownerToken, ownerId, ownerEmail;
  let adminToken, adminId, adminEmail;
  let memberToken, memberId, memberEmail;
  let viewerToken, viewerId, viewerEmail;
  let outsiderToken, outsiderId, outsiderEmail;

  let projectId;
  let incidentId;

  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }

    db = initDb(TEST_DB_PATH);
    runMigrations(db);
    app = createApp();

    const rand = crypto.randomUUID().slice(0, 8);

    // 1. Owner
    ownerEmail = `audit_owner_${rand}@bugreplay.dev`;
    const r1 = await request(app).post('/api/v1/auth/register').send({ email: ownerEmail, password: 'Password123!' });
    ownerToken = r1.body.data.token;
    ownerId = r1.body.data.user.id;

    // 2. Admin
    adminEmail = `audit_admin_${rand}@bugreplay.dev`;
    const r2 = await request(app).post('/api/v1/auth/register').send({ email: adminEmail, password: 'Password123!' });
    adminToken = r2.body.data.token;
    adminId = r2.body.data.user.id;

    // 3. Member
    memberEmail = `audit_member_${rand}@bugreplay.dev`;
    const r3 = await request(app).post('/api/v1/auth/register').send({ email: memberEmail, password: 'Password123!' });
    memberToken = r3.body.data.token;
    memberId = r3.body.data.user.id;

    // 4. Viewer
    viewerEmail = `audit_viewer_${rand}@bugreplay.dev`;
    const r4 = await request(app).post('/api/v1/auth/register').send({ email: viewerEmail, password: 'Password123!' });
    viewerToken = r4.body.data.token;
    viewerId = r4.body.data.user.id;

    // 5. Outsider
    outsiderEmail = `audit_outsider_${rand}@bugreplay.dev`;
    const r5 = await request(app).post('/api/v1/auth/register').send({ email: outsiderEmail, password: 'Password123!' });
    outsiderToken = r5.body.data.token;
    outsiderId = r5.body.data.user.id;

    // 6. Create test project as Owner
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Audit Compliance App', allowed_domains: 'https://audit.test.com' });
    projectId = projRes.body.data.project.id;

    // 7. Add Admin, Member, Viewer to project
    await TeamsService.inviteMember(ownerId, projectId, { email: adminEmail, role: 'ADMIN' });
    await TeamsService.inviteMember(ownerId, projectId, { email: memberEmail, role: 'MEMBER' });
    await TeamsService.inviteMember(ownerId, projectId, { email: viewerEmail, role: 'VIEWER' });

    // 8. Ingest test incident
    incidentId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO incidents (
        id, project_id, status, error_message, error_type,
        page_url, user_agent, telemetry_json, generation_status, generated_playwright_test
      ) VALUES (?, ?, 'OPEN', 'TypeError: Cannot read properties of undefined (reading audit)', 'TypeError',
        'https://audit.test.com/settings', 'Mozilla/5.0 Test', '[]', 'COMPLETED',
        '// Playwright audit test\nimport { test, expect } from "@playwright/test";\ntest("reproduce", async () => {});')
    `).run(incidentId, projectId);
  });

  after(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
  });

  test('Migration 007_enterprise_audit_logs creates audit_logs schema with all enterprise columns', () => {
    const columns = db.prepare("PRAGMA table_info('audit_logs')").all().map((c) => c.name);
    assert.ok(columns.includes('id'), 'Missing id');
    assert.ok(columns.includes('project_id'), 'Missing project_id');
    assert.ok(columns.includes('actor_id'), 'Missing actor_id');
    assert.ok(columns.includes('actor_email'), 'Missing actor_email');
    assert.ok(columns.includes('actor_role'), 'Missing actor_role');
    assert.ok(columns.includes('action'), 'Missing action');
    assert.ok(columns.includes('target_type'), 'Missing target_type');
    assert.ok(columns.includes('target_id'), 'Missing target_id');
    assert.ok(columns.includes('target_name'), 'Missing target_name');
    assert.ok(columns.includes('details'), 'Missing details');
    assert.ok(columns.includes('ip_address'), 'Missing ip_address');
    assert.ok(columns.includes('user_agent'), 'Missing user_agent');
    assert.ok(columns.includes('created_at'), 'Missing created_at');
  });

  test('AuditService.record() persists event and parses metadata correctly', () => {
    const entry = AuditService.record({
      projectId,
      actorId: ownerId,
      actorEmail: ownerEmail,
      actorRole: 'OWNER',
      action: AUDIT_ACTIONS.PROJECT_UPDATED,
      targetType: 'PROJECT',
      targetId: projectId,
      targetName: 'Audit Compliance App',
      details: { updatedFields: ['webhook_url'] },
      ipAddress: '192.168.1.100',
      userAgent: 'Compliance-Agent/1.0',
    });

    assert.ok(entry, 'Expected record result');
    assert.strictEqual(entry.projectId, projectId);
    assert.strictEqual(entry.action, AUDIT_ACTIONS.PROJECT_UPDATED);
    assert.strictEqual(entry.actorEmail, ownerEmail);

    const saved = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(entry.id);
    assert.strictEqual(saved.action, AUDIT_ACTIONS.PROJECT_UPDATED);
    assert.strictEqual(saved.ip_address, '192.168.1.100');
    assert.strictEqual(saved.user_agent, 'Compliance-Agent/1.0');
    assert.strictEqual(saved.actor_role, 'OWNER');
    const parsedDetails = JSON.parse(saved.details);
    assert.deepStrictEqual(parsedDetails.updatedFields, ['webhook_url']);
  });

  test('Project and Team operations automatically write audit log entries', async () => {
    // 1. Update project settings
    await ProjectsService.updateProject(ownerId, projectId, { webhook_url: 'https://hooks.slack.com/test' });

    // 2. Rotate API key
    await ProjectsService.rotateApiKey(ownerId, projectId);

    // 3. Update member role
    await TeamsService.updateMemberRole(ownerId, projectId, memberId, 'ADMIN');

    // 4. Update incident status
    await IncidentsService.updateStatus(ownerId, incidentId, 'INVESTIGATING');

    // Verify all actions exist in audit_logs
    const rows = db.prepare('SELECT action FROM audit_logs WHERE project_id = ?').all(projectId);
    const actions = rows.map((r) => r.action);

    assert.ok(actions.includes(AUDIT_ACTIONS.PROJECT_UPDATED), 'Expected PROJECT_UPDATED');
    assert.ok(actions.includes(AUDIT_ACTIONS.API_KEY_ROTATED), 'Expected API_KEY_ROTATED');
    assert.ok(actions.includes(AUDIT_ACTIONS.MEMBER_ROLE_CHANGED), 'Expected MEMBER_ROLE_CHANGED');
    assert.ok(actions.includes(AUDIT_ACTIONS.INCIDENT_STATUS_CHANGED), 'Expected INCIDENT_STATUS_CHANGED');
  });

  test('Cloud test run dispatch records TEST_RUN_DISPATCHED in audit logs', async () => {
    await IncidentsService.runTest(ownerId, incidentId, { simulateStatus: 'REPRODUCED' });

    const runLog = db
      .prepare('SELECT * FROM audit_logs WHERE project_id = ? AND action = ?')
      .get(projectId, AUDIT_ACTIONS.TEST_RUN_DISPATCHED);

    assert.ok(runLog, 'Expected TEST_RUN_DISPATCHED audit log');
    assert.strictEqual(runLog.target_id, incidentId);
  });

  test('GET /api/v1/projects/:id/audit-logs returns paginated logs for OWNER and ADMIN', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs?limit=10&page=1`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.logs));
    assert.ok(res.body.data.logs.length > 0);
    assert.ok(res.body.data.pagination);
    assert.strictEqual(res.body.data.pagination.page, 1);
    assert.strictEqual(res.body.data.pagination.limit, 10);
    assert.ok(res.body.data.pagination.total >= 5);
  });

  test('GET /api/v1/projects/:id/audit-logs supports action filtering', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs?action=${AUDIT_ACTIONS.API_KEY_ROTATED}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.statusCode, 200);
    for (const log of res.body.data.logs) {
      assert.strictEqual(log.action, AUDIT_ACTIONS.API_KEY_ROTATED);
    }
  });

  test('GET /api/v1/projects/:id/audit-logs supports search across actor and details', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs?search=${encodeURIComponent(ownerEmail)}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.logs.length > 0);
    for (const log of res.body.data.logs) {
      assert.strictEqual(log.actor_email, ownerEmail);
    }
  });

  test('RBAC: VIEWER and non-members are forbidden from viewing audit logs', async () => {
    // 1. Viewer attempt
    const vRes = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs`)
      .set('Authorization', `Bearer ${viewerToken}`);
    assert.strictEqual(vRes.statusCode, 403);
    assert.strictEqual(vRes.body.error.code, 'INSUFFICIENT_PERMISSIONS');

    // 2. Outsider attempt
    const oRes = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.strictEqual(oRes.statusCode, 404);
  });

  test('GET /api/v1/projects/:id/audit-logs/export produces downloadable RFC-4180 CSV', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs/export?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');
    assert.ok(res.headers['content-disposition'].includes('.csv'));

    const lines = res.text.split('\r\n');
    assert.ok(lines.length > 2, 'Expected CSV headers and rows');
    assert.ok(lines[0].includes('"ID","Timestamp","Action","Actor Email"'));
    assert.ok(res.text.includes(ownerEmail));
  });

  test('GET /api/v1/projects/:id/audit-logs/export produces downloadable JSON format', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs/export?format=json`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    assert.ok(res.body[0].action);
  });

  test('GET /api/v1/projects/:id/audit-logs/actions returns distinct action list for UI filter', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs/actions`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.data.actions));
    assert.ok(res.body.data.actions.includes(AUDIT_ACTIONS.PROJECT_UPDATED));
    assert.ok(res.body.data.actions.includes(AUDIT_ACTIONS.API_KEY_ROTATED));
  });
});
