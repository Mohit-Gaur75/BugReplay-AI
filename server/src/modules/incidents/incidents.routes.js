import { Router } from 'express';
import { IncidentsController } from './incidents.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// Incident retrieval & modification requires user authentication
router.use(requireAuth);

router.get('/', IncidentsController.list);
router.get('/:id', IncidentsController.getById);
router.patch('/:id/status', IncidentsController.updateStatus);
router.post('/:id/regenerate', IncidentsController.regenerate);
router.post('/:id/create-pr', IncidentsController.createPR);
router.get('/:id/test-file', IncidentsController.getTestFile);
router.delete('/:id', IncidentsController.delete);

export default router;
