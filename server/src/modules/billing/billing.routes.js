import { Router } from 'express';
import { BillingController } from './billing.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/usage', BillingController.getUsage);
router.post('/simulate-upgrade', BillingController.simulateUpgrade);

export default router;
