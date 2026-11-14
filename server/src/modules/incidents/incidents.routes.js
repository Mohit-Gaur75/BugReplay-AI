import { Router } from 'express';
import { IncidentsController } from './incidents.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// Incident retrieval & modification requires user authentication
router.use(requireAuth);

// Real-time Server-Sent Events stream for incident updates
router.get('/stream', IncidentsController.stream);

router.get('/', IncidentsController.list);
router.get('/:id', IncidentsController.getById);
router.patch('/:id/status', IncidentsController.updateStatus);
router.post('/:id/regenerate', IncidentsController.regenerate);
router.post('/:id/run-test', IncidentsController.runTest);
router.get('/:id/test-runs', IncidentsController.getTestRuns);
router.get('/:id/test-run/latest', IncidentsController.getLatestTestRun);
router.post('/:id/create-pr', IncidentsController.createPR);
router.get('/:id/test-file', IncidentsController.getTestFile);
router.delete('/:id', IncidentsController.delete);

export default router;
