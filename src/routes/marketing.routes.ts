import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getCampaigns, createCampaign, getMarketingStats, seedMarketingData } from '../controllers/marketing.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);
router.get('/stats', getMarketingStats);
router.post('/seed', seedMarketingData);

export default router;
