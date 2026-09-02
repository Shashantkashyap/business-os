import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';

export const createServiceRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    const { serviceType, budget, timeline, priority, notes } = req.body;

    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // 1. Create the Service Request
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        userId,
        companyId,
        serviceType,
        budget: budget ? Number(budget) : null,
        timeline,
        priority: priority || 'NORMAL',
        notes,
        status: 'PENDING'
      }
    });



    const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });

    // 3. Log Activity
    const activity = await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATED_REQUEST',
        entityType: 'SERVICE_REQUEST',
        entityId: serviceRequest.id,
        details: `Client ${user?.firstName} requested ${serviceType}.`
      }
    });

    try {
      getIO().emit('new-activity', {
        ...activity,
        user: { firstName: user?.firstName, lastName: user?.lastName }
      });
      getIO().emit('new-request', {
        ...serviceRequest,
        user: { firstName: user?.firstName, lastName: user?.lastName, company: { name: user?.company?.name } }
      });
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.status(201).json({ serviceRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create service request' });
  }
};

export const createDraftServiceRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    const { serviceType, budget, timeline, priority, notes } = req.body;

    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        userId,
        companyId,
        serviceType: serviceType || 'Draft Project',
        budget: budget ? Number(budget) : null,
        timeline,
        priority: priority || 'NORMAL',
        notes,
        status: 'DRAFT'
      }
    });

    res.status(201).json({ serviceRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create draft request' });
  }
};

export const submitDraftServiceRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    const id = req.params.id as string;
    const { budget, timeline, notes } = req.body;

    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const existingRequest = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!existingRequest || existingRequest.userId !== userId) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    const serviceRequest = await prisma.serviceRequest.update({
      where: { id },
      data: {
        budget: budget ? Number(budget) : existingRequest.budget,
        timeline: timeline || existingRequest.timeline,
        notes: notes || existingRequest.notes,
        status: 'PENDING'
      }
    });


    const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });

    const activity = await prisma.activityLog.create({
      data: {
        userId,
        action: 'SUBMITTED_DRAFT',
        entityType: 'SERVICE_REQUEST',
        entityId: serviceRequest.id,
        details: `Client submitted a drafted request for ${serviceRequest.serviceType}.`
      }
    });

    try {
      getIO().emit('new-activity', { ...activity, user: { firstName: user?.firstName, lastName: user?.lastName } });
      getIO().emit('new-request', { ...serviceRequest, user: { firstName: user?.firstName, lastName: user?.lastName, company: { name: user?.company?.name } } });
      getIO().emit('metrics-updated');
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.json({ serviceRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit draft request' });
  }
};

export const getServiceRequests = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const type = req.query.type as string;
    const limit = req.query.limit as string;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = (await prisma.user.findUnique({
      where: { id: req.user?.id as string },
      include: { role: true }
    })) as any;

    const whereClause: any = {};
    if (user?.role?.name !== 'ADMIN' && user?.role?.name !== 'SUPER_ADMIN') {
      whereClause.userId = req.user?.id;
    }
    
    if (type) {
      if (type.includes(',')) {
        whereClause.serviceType = { in: type.split(',') };
      } else {
        whereClause.serviceType = type;
      }
    }
    
    // Hide drafts from general admin feed
    whereClause.status = { not: 'DRAFT' };

    const requests = await prisma.serviceRequest.findMany({
      where: whereClause,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, company: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      ...(limit !== 'all' && { take: 50 })
    });

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
};

export const updateServiceRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    const id = req.params.id as string;
    const { status } = req.body;

    if (!companyId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = (await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })) as any;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id }
    });

    const isAdmin = user?.role?.name === 'ADMIN' || user?.role?.name === 'SUPER_ADMIN';

    if (!serviceRequest || (!isAdmin && serviceRequest.companyId !== companyId)) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    // Update ServiceRequest
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: { status },
      include: { user: { select: { firstName: true, lastName: true, company: { select: { name: true } } } } }
    });

    // Auto-generate invoice if completed
    if (status === 'COMPLETED' && updatedRequest.budget && updatedRequest.budget > 0) {
      const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
      const invoice = await prisma.invoice.create({
        data: {
          companyId,
          clientId: updatedRequest.userId,
          invoiceNo,
          clientName: `${updatedRequest.user.firstName} ${updatedRequest.user.lastName}`,
          amount: updatedRequest.budget,
          tax: 0,
          total: updatedRequest.budget,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          status: 'UNPAID'
        }
      });

      try {
        getIO().emit('new-invoice', invoice);
      } catch (e) {
        console.error('Socket emit error for new invoice:', e);
      }
    }

    // Log the activity
    const admin = user;
    const activity = await prisma.activityLog.create({
      data: {
        userId,
        action: `REQUEST_${status}`,
        entityType: 'SERVICE_REQUEST',
        entityId: serviceRequest.id,
        details: `Admin ${admin?.firstName} marked request ${id.slice(-6)} as ${status.replace('_', ' ')}.`
      }
    });

    try {
      getIO().emit('new-activity', {
        ...activity,
        user: { firstName: admin?.firstName, lastName: admin?.lastName }
      });
      getIO().emit('update-request', updatedRequest);
      getIO().emit('metrics-updated');
    } catch (e) {}

    res.json(updatedRequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update service request status' });
  }
};
