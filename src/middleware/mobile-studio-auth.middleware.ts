import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extending Express Request to include mobileProjectRole
declare global {
  namespace Express {
    interface Request {
      mobileProjectRole?: 'OWNER' | 'EDITOR' | 'VIEWER';
    }
  }
}

export const requireMobileProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await prisma.mobileProject.findUnique({
      where: { id: projectId as string },
      include: {
        collaborators: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is an ADMIN (Admins have implied OWNER access for management)
    if (user.role === 'ADMIN' || user.roleId === 'ADMIN') { // Adjust based on how roles are evaluated
       req.mobileProjectRole = 'OWNER';
       return next();
    }

    if (project.ownerId === user.userId || project.ownerId === user.id) {
      req.mobileProjectRole = 'OWNER';
      return next();
    }

    const collaborator = project.collaborators?.find((c: any) => c.userId === user.userId || c.userId === user.id);
    if (collaborator) {
      req.mobileProjectRole = collaborator.role as 'OWNER' | 'EDITOR' | 'VIEWER';
      return next();
    }

    return res.status(403).json({ error: 'Forbidden: You do not have access to this project' });
  } catch (error) {
    console.error('Error verifying mobile project access:', error);
    res.status(500).json({ error: 'Internal server error during authorization' });
  }
};

export const requireMobileEditor = async (req: Request, res: Response, next: NextFunction) => {
  await requireMobileProjectAccess(req, res, () => {
    if (req.mobileProjectRole === 'OWNER' || req.mobileProjectRole === 'EDITOR') {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Requires editor access' });
  });
};

export const requireMobileOwner = async (req: Request, res: Response, next: NextFunction) => {
  await requireMobileProjectAccess(req, res, () => {
    if (req.mobileProjectRole === 'OWNER') {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Requires owner access' });
  });
};
