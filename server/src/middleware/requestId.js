import crypto from 'crypto';

/**
 * Distributed Trace & Request ID Middleware
 * Assigns or propagates X-Request-Id header for distributed correlation and structured debugging.
 */
export function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId && typeof incomingId === 'string' ? incomingId : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
