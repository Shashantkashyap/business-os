import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

export const uploadToCloudinary = async (filePath: string, folder: string = 'businessos') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto' // Supports images, pdfs, etc.
    });
    return result;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error('Failed to upload file');
  }
};
