import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireProjectViewer, requireProjectEditor, requireProjectOwner } from '../middleware/studio-auth.middleware.js';
import {
  getProjects,
  createProject,
  getProjectDetails,
  updateFile,
  publishProject,
  updateProjectSettings
} from '../controllers/studio.controller.js';

const router = Router();

// Base routes (only need standard authentication)
router.use(authenticate);

router.get('/projects', getProjects);
router.post('/projects', createProject);

// Project specific routes (require project-level permissions)
router.get('/projects/:projectId', requireProjectViewer as any, getProjectDetails);
router.patch('/projects/:projectId', requireProjectOwner as any, updateProjectSettings);
router.patch('/projects/:projectId/files/:fileId', requireProjectEditor as any, updateFile);
router.post('/projects/:projectId/publish', requireProjectOwner as any, publishProject);

export default router;
