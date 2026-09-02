import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireMobileProjectAccess, requireMobileEditor, requireMobileOwner } from '../middleware/mobile-studio-auth.middleware.js';
import {
  getProjects,
  createProject,
  getProjectDetails,
  updateFile,
  updateScreen,
  updateProjectSettings,
  exportProject
} from '../controllers/mobile-studio.controller.js';

const router = Router();

// Base routes
router.use(authenticate);

router.get('/projects', getProjects);
router.post('/projects', createProject);

// Project specific routes
router.get('/projects/:projectId', requireMobileProjectAccess as any, getProjectDetails);
router.patch('/projects/:projectId', requireMobileOwner as any, updateProjectSettings);
router.patch('/projects/:projectId/files/:fileId', requireMobileEditor as any, updateFile);
router.patch('/projects/:projectId/screens/:screenId', requireMobileEditor as any, updateScreen);
router.post('/projects/:projectId/export', requireMobileProjectAccess as any, exportProject);

export default router;
