import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projects = await prisma.project.findMany({
      where: { companyId },
      include: {
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProjectStats = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projects = await prisma.project.findMany({
      where: { companyId },
      select: { status: true, progress: true }
    });

    const active = projects.filter(p => p.status !== 'COMPLETED').length;
    const completed = projects.filter(p => p.status === 'COMPLETED').length;
    const atRisk = projects.filter(p => p.status === 'AT_RISK').length;
    const totalProgress = projects.reduce((acc, p) => acc + p.progress, 0);
    const avgProgress = projects.length > 0 ? Math.round(totalProgress / projects.length) : 0;

    res.json({
      active,
      completed,
      atRisk,
      avgProgress
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch project stats' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { title, description, category, clientId, value, startDate, endDate, serviceRequestId } = req.body;

    if (!companyId || !clientId) {
      res.status(401).json({ error: 'Unauthorized or missing client' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        companyId,
        clientId,
        title,
        description,
        category: category || 'General',
        value: value ? Number(value) : 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: 'ON_TRACK',
        progress: 0,
        serviceRequestId
      },
      include: {
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      }
    });

    getIO().emit('new-project', project);
    getIO().emit('metrics-updated');

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const updateProjectStatus = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const id = req.params.id as string;
    const { status, progress } = req.body;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dataToUpdate: any = {};
    if (status !== undefined) dataToUpdate.status = status;
    if (progress !== undefined) dataToUpdate.progress = Number(progress);

    const project = await prisma.project.update({
      where: { id },
      data: dataToUpdate,
      include: {
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      }
    });

    getIO().emit('update-project', project);
    getIO().emit('metrics-updated');

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const id = req.params.id as string;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await prisma.project.delete({
      where: { id }
    });

    getIO().emit('metrics-updated');

    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
