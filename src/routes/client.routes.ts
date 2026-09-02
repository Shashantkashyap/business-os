import { Router } from 'express';
import { getClientProjects, getProjectActivity, getClientInvoices, payInvoice, updateProfile, updatePassword } from '../controllers/client.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.get('/projects', getClientProjects);
router.get('/projects/:dealId/activity', getProjectActivity);

router.get('/invoices', getClientInvoices);
router.post('/invoices/:invoiceId/pay', payInvoice);

router.put('/profile', updateProfile);
router.put('/password', updatePassword);

export default router;
