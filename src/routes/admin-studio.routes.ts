import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getAllProjects, updateProjectStatus } from '../controllers/admin-studio.controller.js';

const router = Router();

// Ensure all routes require authentication
router.use(authenticate);

router.get('/projects', getAllProjects);
router.patch('/projects/:projectId/status', updateProjectStatus);

export default router;
