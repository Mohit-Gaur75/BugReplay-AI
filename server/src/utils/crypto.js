import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password with bcrypt
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare plain text password with bcrypt hash
 */
export async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Generate a signed JWT for a user
 */
export function generateToken(payload, expiresIn = env.JWT_EXPIRES_IN) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

/**
 * Verify and decode a JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Generate a cryptographically secure project API key
 * Format: br_live_<32_random_bytes_hex>
 */
export function generateApiKey() {
  const randomHex = crypto.randomBytes(32).toString('hex');
  return `br_live_${randomHex}`;
}

/**
 * Compute SHA-256 hash of an API key for safe database storage
 */
export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
