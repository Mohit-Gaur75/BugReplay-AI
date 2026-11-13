import { Router } from 'express';
import { ProjectsController } from './projects.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// All project routes require authentication
router.use(requireAuth);

router.post('/', ProjectsController.create);
router.get('/', ProjectsController.list);
router.get('/:id', ProjectsController.getById);
router.patch('/:id', ProjectsController.update);
router.post('/:id/rotate-key', ProjectsController.rotateKey);
router.delete('/:id', ProjectsController.delete);

export default router;
