import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all studio projects across the platform
export const getAllProjects = async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.websiteProject.findMany({
      where: {
        deletedAt: null
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, avatar: true, email: true }
        },
        _count: {
          select: { collaborators: true, files: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching admin projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update project status (e.g. disabling a project)
export const updateProjectStatus = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status } = req.body; // e.g. 'ACTIVE', 'DISABLED'

    if (!projectId || !status) {
      return res.status(400).json({ error: 'Project ID and status are required' });
    }

    const updatedProject = await prisma.websiteProject.update({
      where: { id: projectId as string },
      data: { status }
    });

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
