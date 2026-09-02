import type { Response } from 'express';
import prisma from '../config/db.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { getIO } from '../config/socket.js';

export const getAnnouncements = async (_req: AuthRequest, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      include: {
        author: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

export const getAllAnnouncements = async (_req: AuthRequest, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      include: {
        author: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    res.status(500).json({ error: 'Failed to fetch all announcements' });
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    const authorId = req.user?.id;

    if (!title || !content || !authorId) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }

    const newAnnouncement = await prisma.announcement.create({
      data: {
        title,
        content,
        authorId,
        isActive: true
      },
      include: {
        author: { select: { firstName: true, lastName: true } }
      }
    });

    try {
      getIO().emit('new-announcement', newAnnouncement);
    } catch (e) {}

    res.status(201).json(newAnnouncement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
};

export const toggleAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const announcement = await prisma.announcement.findUnique({ where: { id } });

    if (!announcement) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: { isActive: !announcement.isActive },
      include: {
        author: { select: { firstName: true, lastName: true } }
      }
    });

    try {
      getIO().emit('update-announcement', updated);
    } catch (e) {}

    res.json(updated);
  } catch (error) {
    console.error('Error toggling announcement:', error);
    res.status(500).json({ error: 'Failed to toggle announcement' });
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.announcement.delete({ where: { id } });
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
};
