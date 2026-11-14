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
router.post('/:id/test-webhook', ProjectsController.testWebhook);
router.delete('/:id', ProjectsController.delete);

// Team Management & Role-Based Access Control (RBAC)
router.get('/:id/members', ProjectsController.getMembers);
router.post('/:id/members/invite', ProjectsController.inviteMember);
router.patch('/:id/members/:memberId', ProjectsController.updateMemberRole);
router.delete('/:id/members/:memberId', ProjectsController.removeMember);
router.delete('/:id/invitations/:invitationId', ProjectsController.revokeInvitation);

export default router;
