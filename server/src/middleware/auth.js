import { verifyToken } from '../utils/crypto.js';
import { errorResponse } from '../utils/response.js';
import { AuthService } from '../modules/auth/auth.service.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Authentication required. Missing or invalid Bearer token.', 'UNAUTHORIZED', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    return errorResponse(res, 'Invalid or expired authentication token.', 'UNAUTHORIZED', 401);
  }

  const user = AuthService.getUserById(decoded.id);
  if (!user) {
    return errorResponse(res, 'User session invalid or user no longer exists.', 'UNAUTHORIZED', 401);
  }

  req.user = user;
  next();
}
