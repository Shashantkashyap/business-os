import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';

export const getDashboardMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    const isAdmin = user?.role?.name === 'ADMIN';

    // 1. Calculate MRR (Monthly Recurring Revenue)
    const paidInvoices = await prisma.invoice.aggregate({
      where: isAdmin ? { status: 'PAID' } : { companyId, status: 'PAID' },
      _sum: { amount: true }
    });
    const mrr = paidInvoices._sum?.amount || 0;

    // 2. Active Clients (Users with Role = Client)
    const clientRole = await prisma.role.findFirst({ where: { name: 'CLIENT' } });
    const activeClientsCount = clientRole ? await prisma.user.count({
      where: isAdmin ? { roleId: clientRole.id, isActive: true } : { companyId, roleId: clientRole.id, isActive: true }
    }) : 0;

    // 3. Active Projects
    const activeProjectsCount = await prisma.project.count({
      where: isAdmin ? { NOT: { status: { in: ['CLOSED', 'COMPLETED'] } } } : { 
        companyId,
        NOT: { status: { in: ['CLOSED', 'COMPLETED'] } }
      }
    });

    // 4. Pending Service Requests
    const pendingRequestsCount = await prisma.serviceRequest.count({
      where: isAdmin ? { status: 'PENDING' } : { companyId, status: 'PENDING' }
    });

    res.json({
      mrr,
      activeClientsCount,
      activeProjectsCount,
      pendingRequestsCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

export const getSystemActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    const isAdmin = user?.role?.name === 'ADMIN';

    const activities = await prisma.activityLog.findMany({
      where: isAdmin ? {} : { user: { companyId } },
      include: {
        user: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json(activities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch system activity' });
  }
};

export const getAllSystemActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    const isAdmin = user?.role?.name === 'ADMIN';

    const activities = await prisma.activityLog.findMany({
      where: isAdmin ? {} : { user: { companyId } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, company: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log("getAllSystemActivity returning:", activities.length, "records for user:", userId);

    res.json(activities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch all system activity' });
  }
};

export const getUsersList = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    const isAdmin = user?.role?.name === 'ADMIN';

    const users = await prisma.user.findMany({
      where: isAdmin ? {} : { companyId },
      include: {
        company: { select: { name: true } },
        role: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Remove passwords before sending to frontend
    const safeUsers = users.map(u => {
      const { password, ...safeUser } = u;
      return safeUser;
    });

    res.json(safeUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users list' });
  }
};
