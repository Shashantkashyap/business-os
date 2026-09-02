import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';

export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // req.file is populated by multer in the route middleware
    const result = await uploadToCloudinary(req.file.path);
    
    res.json({
      message: 'File uploaded successfully',
      url: result.secure_url,
      format: result.format,
      public_id: result.public_id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload file to Cloudinary' });
  }
};
