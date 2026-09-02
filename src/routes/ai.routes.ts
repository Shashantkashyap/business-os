import { Router } from 'express';
import { handleChat, draftAssistant, getAutomations, createAutomation, updateAutomationStatus } from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/chat', authenticate, handleChat);
router.post('/draft-assistant', authenticate, draftAssistant);

router.get('/automations', authenticate, getAutomations);
router.post('/automations', authenticate, createAutomation);
router.put('/automations/:id/status', authenticate, updateAutomationStatus);

export default router;
