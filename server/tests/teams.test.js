import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initDb, closeDb, getDb } from '../src/db/db.js';
import { runMigrations } from '../src/db/migrations.js';
import { ROLES, getProjectRole } from '../src/middleware/rbac.js';
import { TeamsService } from '../src/modules/projects/teams.service.js';
import fs from 'fs';
import crypto from 'crypto';

const TEST_DB_PATH = './data/test_teams.db';

describe('Multi-User Team Management & Role-Based Access Control (RBAC)', () => {
  let app;
  let db;

  // Users
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

    // 1. Register Owner
    ownerEmail = `owner_${rand}@bugreplay.dev`;
    const r1 = await request(app).post('/api/v1/auth/register').send({ email: ownerEmail, password: 'Password123!' });
    ownerToken = r1.body.data.token;
    ownerId = r1.body.data.user.id;

    // 2. Register Admin
    adminEmail = `admin_${rand}@bugreplay.dev`;
    const r2 = await request(app).post('/api/v1/auth/register').send({ email: adminEmail, password: 'Password123!' });
    adminToken = r2.body.data.token;
    adminId = r2.body.data.user.id;

    // 3. Register Member
    memberEmail = `member_${rand}@bugreplay.dev`;
    const r3 = await request(app).post('/api/v1/auth/register').send({ email: memberEmail, password: 'Password123!' });
    memberToken = r3.body.data.token;
    memberId = r3.body.data.user.id;

    // 4. Register Viewer
    viewerEmail = `viewer_${rand}@bugreplay.dev`;
    const r4 = await request(app).post('/api/v1/auth/register').send({ email: viewerEmail, password: 'Password123!' });
    viewerToken = r4.body.data.token;
    viewerId = r4.body.data.user.id;

    // 5. Register Outsider
    outsiderEmail = `outsider_${rand}@bugreplay.dev`;
    const r5 = await request(app).post('/api/v1/auth/register').send({ email: outsiderEmail, password: 'Password123!' });
    outsiderToken = r5.body.data.token;
    outsiderId = r5.body.data.user.id;

    // Create Project under Owner
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Enterprise Team Project' });
    projectId = projRes.body.data.project.id;

    // Seed test incident
    incidentId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO incidents (
        id, project_id, error_message, error_type, page_url,
        telemetry_json, generated_playwright_test, status, generation_status
      ) VALUES (?, ?, 'Team Checkout Crash', 'TypeError', 'http://localhost/cart', '[]', '// test script', 'OPEN', 'COMPLETED')
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

  test('Project creator is automatically registered as OWNER in project_members', () => {
    const role = getProjectRole(ownerId, projectId);
    assert.equal(role, ROLES.OWNER);

    const members = db.prepare('SELECT * FROM project_members WHERE project_id = ?').all(projectId);
    assert.equal(members.length, 1);
    assert.equal(members[0].user_id, ownerId);
    assert.equal(members[0].role, ROLES.OWNER);
  });

  test('Owner invites Admin, Member, and Viewer directly to the project', async () => {
    // 1. Invite Admin
    const resAdmin = await request(app)
      .post(`/api/v1/projects/${projectId}/members/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: adminEmail, role: 'ADMIN' });

    assert.equal(resAdmin.status, 201);
    assert.equal(resAdmin.body.data.type, 'DIRECT_ADD');
    assert.equal(resAdmin.body.data.member.role, 'ADMIN');

    // 2. Invite Member
    const resMember = await request(app)
      .post(`/api/v1/projects/${projectId}/members/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: memberEmail, role: 'MEMBER' });

    assert.equal(resMember.status, 201);
    assert.equal(resMember.body.data.member.role, 'MEMBER');

    // 3. Invite Viewer
    const resViewer = await request(app)
      .post(`/api/v1/projects/${projectId}/members/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: viewerEmail, role: 'VIEWER' });

    assert.equal(resViewer.status, 201);
    assert.equal(resViewer.body.data.member.role, 'VIEWER');

    // Check roles
    assert.equal(getProjectRole(adminId, projectId), ROLES.ADMIN);
    assert.equal(getProjectRole(memberId, projectId), ROLES.MEMBER);
    assert.equal(getProjectRole(viewerId, projectId), ROLES.VIEWER);
  });

  test('GET /api/v1/projects/:id/members lists all team members with roles', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.members.length, 4);

    const roles = res.body.data.members.map((m) => m.role);
    assert.ok(roles.includes('OWNER'));
    assert.ok(roles.includes('ADMIN'));
    assert.ok(roles.includes('MEMBER'));
    assert.ok(roles.includes('VIEWER'));
  });

  test('Cannot invite an already registered member (409 Conflict)', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/members/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: adminEmail, role: 'ADMIN' });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ALREADY_MEMBER');
  });

  test('Pending Invitation: non-existing user receives pending invite, auto-joins upon register', async () => {
    const futureUserEmail = `future_${Date.now()}@bugreplay.dev`;

    const inviteRes = await request(app)
      .post(`/api/v1/projects/${projectId}/members/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: futureUserEmail, role: 'MEMBER' });

    assert.equal(inviteRes.status, 201);
    assert.equal(inviteRes.body.data.type, 'INVITATION_SENT');
    assert.ok(inviteRes.body.data.invitation.token);

    // Register user with that email
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: futureUserEmail, password: 'Password123!' });

    assert.equal(regRes.status, 201);
    const futureUserId = regRes.body.data.user.id;

    // Verify user is now an active member
    const role = getProjectRole(futureUserId, projectId);
    assert.equal(role, ROLES.MEMBER);
  });

  test('RBAC: Member cannot invite other users (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/members/invite`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: 'hack@bugreplay.dev', role: 'VIEWER' });

    assert.equal(res.status, 403);
  });

  test('RBAC: Admin cannot demote or remove the Project OWNER (403 Forbidden)', async () => {
    const demoteRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'VIEWER' });

    assert.equal(demoteRes.status, 403);
    assert.equal(demoteRes.body.error.code, 'CANNOT_DEMOTE_OWNER');

    const removeRes = await request(app)
      .delete(`/api/v1/projects/${projectId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(removeRes.status, 403);
    assert.equal(removeRes.body.error.code, 'CANNOT_REMOVE_OWNER');
  });

  test('RBAC: Viewer has read-only access (cannot update status or execute cloud tests)', async () => {
    // 1. Viewer can read incident
    const readRes = await request(app)
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    assert.equal(readRes.status, 200);

    // 2. Viewer cannot update status
    const updateRes = await request(app)
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'RESOLVED' });
    assert.equal(updateRes.status, 403);

    // 3. Viewer cannot run cloud test
    const runTestRes = await request(app)
      .post(`/api/v1/incidents/${incidentId}/run-test`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert.equal(runTestRes.status, 403);

    // 4. Viewer cannot delete project
    const delProjRes = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    assert.equal(delProjRes.status, 403);
  });

  test('RBAC: Member can update status and run cloud tests, but cannot delete project', async () => {
    // 1. Member can update status
    const updateRes = await request(app)
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'INVESTIGATING' });
    assert.equal(updateRes.status, 200);

    // 2. Member cannot delete project
    const delProjRes = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(delProjRes.status, 403);
  });

  test('Cross-Project Isolation: outsider cannot access project or incidents', async () => {
    const projRes = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.equal(projRes.status, 404);

    const incRes = await request(app)
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    assert.equal(incRes.status, 404);
  });

  test('Owner can change role and remove member from project', async () => {
    // 1. Change viewer to member
    const patchRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/members/${viewerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'MEMBER' });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.data.role, 'MEMBER');

    // 2. Remove member
    const delRes = await request(app)
      .delete(`/api/v1/projects/${projectId}/members/${viewerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(delRes.status, 200);

    // Verify removed
    assert.equal(getProjectRole(viewerId, projectId), null);
  });
});
