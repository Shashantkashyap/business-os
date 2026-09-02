import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminProjects = async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.mobileProject.findMany({
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { files: true, screens: true, collaborators: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching admin mobile projects:', error);
    res.status(500).json({ error: 'Failed to fetch admin mobile projects' });
  }
};

export const getAdminStats = async (_req: Request, res: Response) => {
  try {
    const totalProjects = await prisma.mobileProject.count();
    const activeProjects = await prisma.mobileProject.count({ where: { status: 'ACTIVE' } });
    const flutterProjects = await prisma.mobileProject.count({ where: { framework: 'FLUTTER' } });
    
    res.json({
      totalProjects,
      activeProjects,
      flutterProjects
    });
  } catch (error) {
    console.error('Error fetching admin mobile stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin mobile stats' });
  }
};

export const deleteAdminProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    await prisma.mobileProject.delete({ where: { id: projectId as string } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting mobile project (admin):', error);
    res.status(500).json({ error: 'Failed to delete mobile project' });
  }
};
