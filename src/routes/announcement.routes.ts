import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { getAnnouncements, getAllAnnouncements, createAnnouncement, toggleAnnouncement, deleteAnnouncement } from '../controllers/announcement.controller.js';

const router = Router();

router.use(authenticate);

// Client view
router.get('/', getAnnouncements);

// Admin view and management
router.get('/all', getAllAnnouncements);
router.post('/', createAnnouncement);
router.patch('/:id/toggle', toggleAnnouncement);
router.delete('/:id', deleteAnnouncement);

export default router;
