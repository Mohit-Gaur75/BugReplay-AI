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
}
