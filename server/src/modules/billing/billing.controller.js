import { getDb } from '../../db/db.js';
import { successResponse, errorResponse } from '../../utils/response.js';

const PLAN_LIMITS = {
  FREE: 50,
  PRO: 1000,
  TEAM: 5000,
};

export class BillingController {
  static getUsage(req, res, next) {
    try {
      const db = getDb();
      const currentPeriod = new Date().toISOString().slice(0, 7);

      // Sum usage across all projects of this user
      const row = db.prepare(`
        SELECT COALESCE(SUM(u.incident_count), 0) as total_used
        FROM usage_records u
        JOIN projects p ON p.id = u.project_id
        WHERE p.user_id = ? AND u.billing_period = ?
      `).get(req.user.id, currentPeriod);

      const used = row ? row.total_used : 0;
      const limit = PLAN_LIMITS[req.user.plan_tier] || 50;

      return successResponse(res, {
        plan_tier: req.user.plan_tier,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        billing_period: currentPeriod,
      }, 'Usage retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  static simulateUpgrade(req, res, next) {
    try {
      const { plan_tier } = req.body;
      const validTiers = ['FREE', 'PRO', 'TEAM'];

      if (!validTiers.includes(plan_tier)) {
        return errorResponse(res, 'Invalid plan tier. Choose FREE, PRO, or TEAM.', 'INVALID_PLAN', 400);
      }

      const db = getDb();

      const upgradeTx = db.transaction(() => {
        db.prepare('UPDATE users SET plan_tier = ? WHERE id = ?').run(plan_tier, req.user.id);
        db.prepare(`
          INSERT INTO subscriptions (id, user_id, plan_tier, status)
          VALUES (?, ?, ?, 'ACTIVE')
          ON CONFLICT(user_id) DO UPDATE SET
            plan_tier = ?,
            status = 'ACTIVE'
        `).run(crypto.randomUUID(), req.user.id, plan_tier, plan_tier);

        // Audit log
        db.prepare(`
          INSERT INTO audit_logs (id, user_id, action, details)
          VALUES (?, ?, 'PLAN_TIER_CHANGED', ?)
        `).run(crypto.randomUUID(), req.user.id, JSON.stringify({ newPlan: plan_tier }));
      });

      upgradeTx();

      return successResponse(res, { plan_tier }, `Successfully switched plan to ${plan_tier} (Simulation)`, 200);
    } catch (err) {
      next(err);
    }
  }
}
