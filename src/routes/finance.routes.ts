import { Router } from 'express';
import { getInvoices, createInvoice, createPaymentOrder, verifyPayment } from '../controllers/finance.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/invoices', getInvoices);
router.post('/invoices', createInvoice);
router.post('/invoices/:id/pay', createPaymentOrder);
router.post('/invoices/verify', verifyPayment);

export default router;
