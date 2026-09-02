import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';

export const getClientProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch ServiceRequests (the initial requests/drafts)
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch actual Projects (after Admin creates them)
    const activeProjects = await prisma.project.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { name: true } }
      }
    });

    // Map ServiceRequests to the unified frontend format
    const formattedRequests = serviceRequests.map(sr => ({
      id: sr.id,
      serviceType: sr.serviceType,
      budget: sr.budget,
      timeline: sr.timeline,
      status: sr.status,
      createdAt: sr.createdAt,
      dealId: sr.id,
      title: sr.serviceType,
      notes: sr.notes,
      isServiceRequest: true
    }));

    // Map Projects to the unified frontend format
    const formattedProjects = activeProjects.map(p => ({
      id: p.id,
      serviceType: p.category, // Map category to serviceType for UI compatibility
      budget: p.value,
      timeline: null,
      status: p.status,
      createdAt: p.createdAt,
      dealId: p.id,
      title: p.title,
      notes: p.description,
      progress: p.progress,
      isProject: true
    }));

    // Combine them, sort by date
    const combined = [...formattedRequests, ...formattedProjects].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(combined);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch client projects' });
  }
};

export const getProjectActivity = async (req: AuthRequest, res: Response) => {
  try {
    const dealId = req.params.dealId as string;
    const activities = await prisma.activityLog.findMany({
      where: {
        entityType: 'SERVICE_REQUEST',
        entityId: dealId
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(activities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
};

export const getClientInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const invoices = await prisma.invoice.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },

    });

    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const payInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const invoiceId = req.params.invoiceId as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice || invoice.clientId !== userId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID' }
    });

    const activity = await prisma.activityLog.create({
      data: {
        userId,
        action: 'PAYMENT_RECEIVED',
        entityType: 'INVOICE',
        entityId: invoice.id,
        details: `Payment received for Invoice ${invoice.invoiceNo}`
      }
    });
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      getIO().emit('new-activity', { ...activity, user });
      getIO().emit('metrics-updated');
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.json(updatedInvoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, companyName } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update User
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
      }
    });

    // Update Company if provided
    if (companyName && user.companyId) {
      await prisma.company.update({
        where: { id: user.companyId },
        data: { name: companyName }
      });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        companyName: companyName || user.company.name
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const updatePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new passwords are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ error: 'Incorrect current password' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};
