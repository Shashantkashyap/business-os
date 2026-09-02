import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getAdminProjects,
  getAdminStats,
  deleteAdminProject
} from '../controllers/admin-mobile-studio.controller.js';

const router = Router();

router.use(authenticate);

router.get('/stats', getAdminStats);
router.get('/projects', getAdminProjects);
router.delete('/projects/:projectId', deleteAdminProject);

export default router;
