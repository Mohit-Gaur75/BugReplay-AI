import crypto from 'crypto';
import { getDb } from '../../db/db.js';
import { ROLES, ROLE_RANKS, getProjectRole } from '../../middleware/rbac.js';
import { AuditService, AUDIT_ACTIONS } from '../../services/audit.service.js';

export class TeamsService {
  /**
   * List members and pending invitations for a project
   */
  static getMembers(userId, projectId) {
    const db = getDb();
    const userRole = getProjectRole(userId, projectId);

    if (!userRole) {
      const error = new Error('Project not found or you do not have permission to view its members.');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const members = db.prepare(`
      SELECT 
        pm.id,
        pm.project_id,
        pm.user_id,
        pm.role,
        pm.created_at as joined_at,
        u.email,
        inviter.email as invited_by_email
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      LEFT JOIN users inviter ON inviter.id = pm.invited_by
      WHERE pm.project_id = ?
      ORDER BY 
        CASE pm.role 
          WHEN 'OWNER' THEN 1 
          WHEN 'ADMIN' THEN 2 
          WHEN 'MEMBER' THEN 3 
          ELSE 4 
        END ASC,
        pm.created_at ASC
    `).all(projectId);

    const pendingInvitations = db.prepare(`
      SELECT 
        pi.id,
        pi.email,
        pi.role,
        pi.status,
        pi.token,
        pi.created_at,
        pi.expires_at,
        inviter.email as invited_by_email
      FROM project_invitations pi
      JOIN users inviter ON inviter.id = pi.invited_by
      WHERE pi.project_id = ? AND pi.status = 'PENDING' AND pi.expires_at > CURRENT_TIMESTAMP
      ORDER BY pi.created_at DESC
    `).all(projectId);

    return {
      projectId,
      currentUserRole: userRole,
      members,
      pendingInvitations,
    };
  }

  /**
   * Invite member to project or add directly if user exists
   */
  static inviteMember(inviterUserId, projectId, { email, role = ROLES.MEMBER }) {
    if (!email || !email.includes('@')) {
      const error = new Error('Valid email address is required.');
      error.statusCode = 400;
      error.code = 'INVALID_EMAIL';
      error.isOperational = true;
      throw error;
    }

    const validRoles = [ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER];
    const upperRole = (role || '').toUpperCase();
    if (!validRoles.includes(upperRole)) {
      const error = new Error(`Invalid role. Permitted roles for invitation: ${validRoles.join(', ')}`);
      error.statusCode = 400;
      error.code = 'INVALID_ROLE';
      error.isOperational = true;
      throw error;
    }

    const inviterRole = getProjectRole(inviterUserId, projectId);
    if (!inviterRole || ROLE_RANKS[inviterRole] < ROLE_RANKS.ADMIN) {
      const error = new Error('Only project owners and administrators can invite team members.');
      error.statusCode = 403;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user already exists
    const existingUser = db.prepare('SELECT id, email FROM users WHERE LOWER(email) = ?').get(normalizedEmail);

    if (existingUser) {
      // Check if already a member
      const existingMember = db.prepare(`
        SELECT role FROM project_members WHERE project_id = ? AND user_id = ?
      `).get(projectId, existingUser.id);

      if (existingMember) {
        const error = new Error(`User ${normalizedEmail} is already a member of this project (Role: ${existingMember.role}).`);
        error.statusCode = 409;
        error.code = 'ALREADY_MEMBER';
        error.isOperational = true;
        throw error;
      }

      // Add directly as project member
      const memberId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO project_members (id, project_id, user_id, role, invited_by, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(memberId, projectId, existingUser.id, upperRole, inviterUserId);

      // Enterprise Audit Log
      AuditService.record({
        projectId,
        actorId: inviterUserId,
        action: AUDIT_ACTIONS.MEMBER_INVITED,
        targetType: 'MEMBER',
        targetId: existingUser.id,
        targetName: normalizedEmail,
        details: { role: upperRole, method: 'DIRECT_ADD' },
      });

      return {
        type: 'DIRECT_ADD',
        member: {
          id: memberId,
          projectId,
          userId: existingUser.id,
          email: existingUser.email,
          role: upperRole,
          joinedAt: new Date().toISOString(),
        },
        message: `User ${normalizedEmail} has been added directly to the project with ${upperRole} permissions.`,
      };
    }

    // 2. User does not exist yet: create durable pending invitation
    const inviteId = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    db.prepare(`
      INSERT INTO project_invitations (id, project_id, email, role, token, invited_by, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, ?)
    `).run(inviteId, projectId, normalizedEmail, upperRole, token, inviterUserId, expiresAt);

    // Enterprise Audit Log
    AuditService.record({
      projectId,
      actorId: inviterUserId,
      action: AUDIT_ACTIONS.MEMBER_INVITED,
      targetType: 'INVITATION',
      targetId: inviteId,
      targetName: normalizedEmail,
      details: { role: upperRole, method: 'PENDING_INVITE', expiresAt },
    });

    return {
      type: 'INVITATION_SENT',
      invitation: {
        id: inviteId,
        projectId,
        email: normalizedEmail,
        role: upperRole,
        token,
        expiresAt,
      },
      message: `Invitation generated for ${normalizedEmail}. When they register with this email, they will automatically join as ${upperRole}.`,
    };
  }

  /**
   * Update role of an existing project member
   */
  static updateMemberRole(actorUserId, projectId, targetUserId, newRole) {
    const validRoles = [ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER];
    const upperRole = (newRole || '').toUpperCase();
    if (!validRoles.includes(upperRole)) {
      const error = new Error(`Invalid role. Permitted roles: ${validRoles.join(', ')}`);
      error.statusCode = 400;
      error.code = 'INVALID_ROLE';
      error.isOperational = true;
      throw error;
    }

    const actorRole = getProjectRole(actorUserId, projectId);
    if (!actorRole || ROLE_RANKS[actorRole] < ROLE_RANKS.ADMIN) {
      const error = new Error('Only project owners and administrators can change member roles.');
      error.statusCode = 403;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const targetMember = db.prepare(`
      SELECT pm.role, u.email 
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ? AND pm.user_id = ?
    `).get(projectId, targetUserId);

    if (!targetMember) {
      const error = new Error('Member not found in this project.');
      error.statusCode = 404;
      error.code = 'MEMBER_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    if (targetMember.role === ROLES.OWNER) {
      const error = new Error('Cannot change the role of the project owner.');
      error.statusCode = 403;
      error.code = 'CANNOT_DEMOTE_OWNER';
      error.isOperational = true;
      throw error;
    }

    // Administrators cannot modify other administrators
    if (actorRole === ROLES.ADMIN && targetMember.role === ROLES.ADMIN) {
      const error = new Error('Only the project owner can change an administrator role.');
      error.statusCode = 403;
      error.code = 'ADMIN_RESTRICTION';
      error.isOperational = true;
      throw error;
    }

    db.prepare(`
      UPDATE project_members SET role = ?
      WHERE project_id = ? AND user_id = ?
    `).run(upperRole, projectId, targetUserId);

    // Enterprise Audit Log
    AuditService.record({
      projectId,
      actorId: actorUserId,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      targetType: 'MEMBER',
      targetId: targetUserId,
      targetName: targetMember.email,
      details: { oldRole: targetMember.role, newRole: upperRole },
    });

    return {
      projectId,
      userId: targetUserId,
      email: targetMember.email,
      role: upperRole,
      message: `Member ${targetMember.email} role updated to ${upperRole}.`,
    };
  }

  /**
   * Remove member from project (or leave project)
   */
  static removeMember(actorUserId, projectId, targetUserId) {
    const actorRole = getProjectRole(actorUserId, projectId);
    if (!actorRole) {
      const error = new Error('Project not found or you do not have permission.');
      error.statusCode = 404;
      error.code = 'PROJECT_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const targetMember = db.prepare(`
      SELECT pm.role, u.email 
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ? AND pm.user_id = ?
    `).get(projectId, targetUserId);

    if (!targetMember) {
      const error = new Error('Member not found in this project.');
      error.statusCode = 404;
      error.code = 'MEMBER_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    if (targetMember.role === ROLES.OWNER) {
      const error = new Error('Project owner cannot be removed. Transfer ownership or delete project instead.');
      error.statusCode = 403;
      error.code = 'CANNOT_REMOVE_OWNER';
      error.isOperational = true;
      throw error;
    }

    // If removing someone else
    if (actorUserId !== targetUserId) {
      if (ROLE_RANKS[actorRole] < ROLE_RANKS.ADMIN) {
        const error = new Error('Only administrators and owners can remove team members.');
        error.statusCode = 403;
        error.code = 'INSUFFICIENT_PERMISSIONS';
        error.isOperational = true;
        throw error;
      }

      if (actorRole === ROLES.ADMIN && targetMember.role === ROLES.ADMIN) {
        const error = new Error('Only the project owner can remove administrators.');
        error.statusCode = 403;
        error.code = 'ADMIN_RESTRICTION';
        error.isOperational = true;
        throw error;
      }
    }

    db.prepare(`
      DELETE FROM project_members
      WHERE project_id = ? AND user_id = ?
    `).run(projectId, targetUserId);

    // Enterprise Audit Log
    AuditService.record({
      projectId,
      actorId: actorUserId,
      action: AUDIT_ACTIONS.MEMBER_REMOVED,
      targetType: 'MEMBER',
      targetId: targetUserId,
      targetName: targetMember.email,
      details: { previousRole: targetMember.role, isSelfRemoval: actorUserId === targetUserId },
    });

    return {
      projectId,
      userId: targetUserId,
      email: targetMember.email,
      removed: true,
      message: `Member ${targetMember.email} removed from project.`,
    };
  }

  /**
   * Revoke a pending invitation
   */
  static revokeInvitation(actorUserId, projectId, invitationId) {
    const actorRole = getProjectRole(actorUserId, projectId);
    if (!actorRole || ROLE_RANKS[actorRole] < ROLE_RANKS.ADMIN) {
      const error = new Error('Only project owners and administrators can revoke invitations.');
      error.statusCode = 403;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.isOperational = true;
      throw error;
    }

    const db = getDb();
    const invRow = db.prepare(`
      SELECT email, role FROM project_invitations 
      WHERE id = ? AND project_id = ? AND status = 'PENDING'
    `).get(invitationId, projectId);

    const result = db.prepare(`
      UPDATE project_invitations 
      SET status = 'REVOKED'
      WHERE id = ? AND project_id = ? AND status = 'PENDING'
    `).run(invitationId, projectId);

    if (result.changes === 0) {
      const error = new Error('Pending invitation not found.');
      error.statusCode = 404;
      error.code = 'INVITATION_NOT_FOUND';
      error.isOperational = true;
      throw error;
    }

    // Enterprise Audit Log
    AuditService.record({
      projectId,
      actorId: actorUserId,
      action: AUDIT_ACTIONS.INVITATION_REVOKED,
      targetType: 'INVITATION',
      targetId: invitationId,
      targetName: invRow?.email,
      details: { role: invRow?.role },
    });

    return {
      invitationId,
      revoked: true,
      message: 'Invitation revoked successfully.',
    };
  }

  /**
   * Automatically claims all pending invitations when a user registers
   */
  static claimPendingInvitations(userId, email) {
    if (!userId || !email) return 0;
    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();

    const pending = db.prepare(`
      SELECT id, project_id, role, invited_by 
      FROM project_invitations
      WHERE LOWER(email) = ? AND status = 'PENDING' AND expires_at > CURRENT_TIMESTAMP
    `).all(normalizedEmail);

    let claimed = 0;
    const claimTx = db.transaction(() => {
      for (const inv of pending) {
        db.prepare(`
          INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, invited_by, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(crypto.randomUUID(), inv.project_id, userId, inv.role, inv.invited_by);

        db.prepare(`
          UPDATE project_invitations SET status = 'ACCEPTED' WHERE id = ?
        `).run(inv.id);

        claimed += 1;
      }
    });

    claimTx();
    return claimed;
  }
}
