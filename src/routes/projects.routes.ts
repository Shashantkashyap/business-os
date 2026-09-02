import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getProjects,
  getProjectStats,
  createProject,
  updateProjectStatus,
  deleteProject
} from '../controllers/projects.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getProjects);
router.get('/stats', getProjectStats);
router.post('/', createProject);
router.put('/:id', updateProjectStatus);
router.delete('/:id', deleteProject);

export default router;
