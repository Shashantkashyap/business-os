import { Router } from 'express';
import { createServiceRequest, createDraftServiceRequest, submitDraftServiceRequest, getServiceRequests, updateServiceRequestStatus } from '../controllers/service-requests.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.post('/', createServiceRequest);
router.post('/draft', createDraftServiceRequest);
router.put('/:id/submit', submitDraftServiceRequest);
router.get('/', getServiceRequests);
router.put('/:id/status', updateServiceRequestStatus);

export default router;
