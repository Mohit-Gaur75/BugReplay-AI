import crypto from 'crypto';
import { getDb } from '../../db/db.js';
import { hashPassword, comparePassword, generateToken } from '../../utils/crypto.js';

export class AuthService {
  static async register({ email, password }) {
    const db = getDb();
    
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      const error = new Error('An account with this email already exists');
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      error.isOperational = true;
      throw error;
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    const insertUserTx = db.transaction(() => {
      // Create user
      db.prepare(`
        INSERT INTO users (id, email, password_hash, plan_tier)
        VALUES (?, ?, ?, 'FREE')
      `).run(userId, email, passwordHash);

      // Create initial FREE subscription record
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_tier, status)
        VALUES (?, ?, 'FREE', 'ACTIVE')
      `).run(crypto.randomUUID(), userId);
    });

    insertUserTx();

    const user = {
      id: userId,
      email,
      plan_tier: 'FREE',
    };

    const token = generateToken({ id: user.id, email: user.email, plan_tier: user.plan_tier });

    return { user, token };
  }

  static async login({ email, password }) {
    const db = getDb();
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!userRow) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      error.isOperational = true;
      throw error;
    }

    const isMatch = await comparePassword(password, userRow.password_hash);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      error.isOperational = true;
      throw error;
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      plan_tier: userRow.plan_tier,
      created_at: userRow.created_at,
    };

    const token = generateToken({ id: user.id, email: user.email, plan_tier: user.plan_tier });

    return { user, token };
  }

  static getUserById(userId) {
    const db = getDb();
    const userRow = db.prepare('SELECT id, email, plan_tier, created_at FROM users WHERE id = ?').get(userId);
    return userRow || null;
  }
}
