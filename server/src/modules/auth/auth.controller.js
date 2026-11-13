import { AuthService } from './auth.service.js';
import { registerSchema, loginSchema } from './auth.validation.js';
import { successResponse } from '../../utils/response.js';

export class AuthController {
  static async register(req, res, next) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await AuthService.register(validatedData);
      return successResponse(res, result, 'User registered successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await AuthService.login(validatedData);
      return successResponse(res, result, 'Login successful', 200);
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      return successResponse(res, { user: req.user }, 'Current user context retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      return successResponse(res, null, 'Logged out successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: { message: 'New password must be at least 8 characters long.' },
        });
      }
      await AuthService.changePassword(req.user.id, currentPassword, newPassword);
      return successResponse(res, null, 'Password updated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static auditLogs(req, res, next) {
    try {
      const logs = AuthService.getAuditLogs(req.user.id);
      return successResponse(res, { audit_logs: logs }, 'Audit logs retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
}
