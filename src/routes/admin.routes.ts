import { Router } from 'express';
import { getDashboardMetrics, getSystemActivity, getUsersList, getAllSystemActivity } from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.get('/metrics', getDashboardMetrics);
router.get('/activity', getSystemActivity);
router.get('/activity/all', getAllSystemActivity);
router.get('/users', getUsersList);

export default router;
