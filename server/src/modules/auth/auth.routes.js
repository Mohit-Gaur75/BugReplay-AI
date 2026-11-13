import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.me);
router.patch('/password', requireAuth, AuthController.changePassword);
router.get('/audit-logs', requireAuth, AuthController.auditLogs);

export default router;
