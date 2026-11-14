import { errorResponse } from '../utils/response.js';

/**
 * High-Performance In-Memory Sliding Window Rate Limiter
 * Enforces per-IP and per-API-Key limits with RFC-compliant headers.
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60000; // 1 minute default
  const maxRequests = options.max || 100;
  const keyGenerator = options.keyGenerator || ((req) => req.ip || req.connection?.remoteAddress || 'unknown');

  // Map: key -> Array of timestamps
  const hits = new Map();

  // Periodic cleanup every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, Math.max(windowMs * 2, 60000));

  if (cleanupInterval.unref) cleanupInterval.unref();

  return function rateLimiterMiddleware(req, res, next) {
    if (process.env.NODE_ENV === 'test') {
      return next(); // Skip in unit test runs for determinism
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const timestamps = hits.get(key) || [];

    // Filter to current window
    const recent = timestamps.filter((t) => now - t < windowMs);
    const remaining = Math.max(0, maxRequests - recent.length);
    const resetTime = Math.ceil((now + windowMs) / 1000);

    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetTime);

    if (recent.length >= maxRequests) {
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return errorResponse(
        res,
        `Too many requests. Rate limit of ${maxRequests} requests per minute exceeded.`,
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

export const generalLimiter = createRateLimiter({
  windowMs: 60000,
  max: 300,
});

export const authLimiter = createRateLimiter({
  windowMs: 60000,
  max: 30, // Strict brute-force prevention on login / register
});

export const ingestLimiter = createRateLimiter({
  windowMs: 60000,
  max: 1000,
  keyGenerator: (req) => req.headers['x-api-key'] || req.query.apiKey || req.ip || 'ingest_unknown',
});
