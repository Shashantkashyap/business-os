import { Router } from 'express';
import { getEmployees, createEmployee, getHrAnalytics, seedHrData } from '../controllers/hr.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/employees', getEmployees);
router.post('/employees', createEmployee);
router.get('/analytics', getHrAnalytics);
router.post('/seed', seedHrData);

export default router;
