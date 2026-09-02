import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';

export const getCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    const isAdmin = user?.role?.name === 'ADMIN' || user?.role?.name === 'SUPER_ADMIN';

    const whereClause: any = { companyId };
    if (!isAdmin) {
      whereClause.clientId = userId;
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        company: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(campaigns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { name, type, budget, status, clientId } = req.body;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const campaign = await prisma.campaign.create({
      data: {
        companyId,
        clientId: clientId || null,
        name,
        type: type || 'ADS',
        budget: budget ? Number(budget) : 0,
        status: status || 'ACTIVE',
        startDate: new Date()
      },
      include: {
        company: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, company: { select: { name: true } } } }
      }
    });

    getIO().emit('new-campaign', campaign);
    getIO().emit('metrics-updated');

    res.status(201).json(campaign);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

export const getMarketingStats = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    if (!companyId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    const isAdmin = user?.role?.name === 'ADMIN' || user?.role?.name === 'SUPER_ADMIN';

    const whereClause: any = { companyId };
    if (!isAdmin) {
      whereClause.clientId = userId;
    }

    const [activeCampaignsCount, allCampaigns] = await Promise.all([
      prisma.campaign.count({ where: { ...whereClause, status: 'ACTIVE' } }),
      prisma.campaign.findMany({ where: whereClause })
    ]);

    const totalAdSpend = allCampaigns.reduce((acc, curr) => acc + (curr.budget || 0), 0);
    const totalLeadsGenerated = Math.floor(totalAdSpend / 35); // Simulated metric based on spend
    const avgConversionRate = 4.8; // Simulated metric

    const totalImpressions = totalAdSpend * 12; // Simulated: ₹1 gets 12 impressions
    const totalClicks = Math.floor(totalImpressions * 0.05); // 5% CTR
    const cpc = totalClicks > 0 ? (totalAdSpend / totalClicks).toFixed(2) : '0.00';

    res.json({
      totalAdSpend,
      totalLeadsGenerated,
      avgConversionRate,
      activeCampaigns: activeCampaignsCount,
      totalImpressions,
      totalClicks,
      cpc
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch marketing stats' });
  }
};

export const seedMarketingData = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const count = await prisma.campaign.count({ where: { companyId } });
    if (count > 0) {
      res.json({ message: 'Marketing data already seeded' });
      return;
    }

    const mockCampaigns = [
      { name: 'Q3 B2B Lead Gen', type: 'LinkedIn', budget: 4200, status: 'ACTIVE' },
      { name: 'Product Launch Retargeting', type: 'Meta Ads', budget: 12500, status: 'ACTIVE' },
      { name: 'Search Intent SEO', type: 'Google Ads', budget: 8100, status: 'PAUSED' },
      { name: 'Awareness Campaign', type: 'TikTok', budget: 2400, status: 'ACTIVE' }
    ];

    for (const campaignData of mockCampaigns) {
      await prisma.campaign.create({
        data: {
          companyId,
          name: campaignData.name,
          type: campaignData.type,
          budget: campaignData.budget,
          status: campaignData.status,
          startDate: new Date()
        }
      });
    }

    getIO().emit('metrics-updated');

    res.json({ message: 'Successfully seeded marketing data' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed marketing data' });
  }
};
