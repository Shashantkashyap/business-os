import { Router } from 'express';
import multer from 'multer';
import { uploadFile } from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import os from 'os';

const router = Router();

// Setup Multer to store files in the OS temp directory before sending to Cloudinary
const upload = multer({ dest: os.tmpdir() });

router.use(authenticate);

// Endpoint expects a form-data field named 'file'
router.post('/', upload.single('file'), uploadFile);

export default router;
