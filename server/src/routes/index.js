import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import projectRoutes from '../modules/projects/projects.routes.js';
import ingestionRoutes from '../modules/ingestion/ingestion.routes.js';
import incidentRoutes from '../modules/incidents/incidents.routes.js';
import billingRoutes from '../modules/billing/billing.routes.js';

const apiRouter = Router();

// API V1 Route Registrations
apiRouter.use('/auth', authRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/ingest', ingestionRoutes);
apiRouter.use('/incidents', incidentRoutes);
apiRouter.use('/billing', billingRoutes);

export default apiRouter;
