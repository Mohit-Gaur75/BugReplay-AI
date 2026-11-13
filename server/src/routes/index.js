import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';

const apiRouter = Router();

// API V1 Route Registrations
apiRouter.use('/auth', authRoutes);

export default apiRouter;
