import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getJobs, createJob, getCandidates, getPipelineStats, seedRecruitmentData } from '../controllers/recruitment.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/jobs', getJobs);
router.post('/jobs', createJob);
router.get('/candidates', getCandidates);
router.get('/stats', getPipelineStats);
router.post('/seed', seedRecruitmentData);

export default router;
