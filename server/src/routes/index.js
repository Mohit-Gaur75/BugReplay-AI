import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import projectRoutes from '../modules/projects/projects.routes.js';

const apiRouter = Router();

// API V1 Route Registrations
apiRouter.use('/auth', authRoutes);
apiRouter.use('/projects', projectRoutes);

export default apiRouter;
