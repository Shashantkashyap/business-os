import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import prisma from '../config/db.js';
import { getIO } from '../config/socket.js';

export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const jobs = await prisma.job.findMany({
      where: { companyId, deletedAt: null },
      include: {
        company: { select: { name: true } },
        _count: { select: { candidates: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

export const createJob = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { title, description, department, location, type, status } = req.body;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const job = await prisma.job.create({
      data: {
        companyId,
        title,
        description,
        department,
        location,
        type: type || 'FULL_TIME',
        status: status || 'OPEN'
      }
    });

    getIO().emit('new-job', job);
    getIO().emit('metrics-updated');

    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

export const getCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const candidates = await prisma.candidate.findMany({
      where: { 
        job: { companyId },
        deletedAt: null 
      },
      include: { job: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(candidates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
};

export const getPipelineStats = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [openRoles, totalCandidates, hiresThisMonth, candidatesByStage] = await Promise.all([
      prisma.job.count({ where: { companyId, status: 'OPEN', deletedAt: null } }),
      prisma.candidate.count({ where: { job: { companyId }, deletedAt: null } }),
      prisma.candidate.count({ 
        where: { 
          job: { companyId }, 
          stage: 'HIRED', 
          updatedAt: { gte: new Date(new Date().setDate(1)) },
          deletedAt: null 
        } 
      }),
      prisma.candidate.groupBy({
        by: ['stage'],
        where: { job: { companyId }, deletedAt: null },
        _count: { stage: true }
      })
    ]);

    res.json({
      openRoles,
      totalCandidates,
      hiresThisMonth,
      avgTimeToHire: 22, // Static mock for now
      candidatesByStage: candidatesByStage.reduce((acc, curr) => {
        acc[curr.stage] = curr._count.stage;
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pipeline stats' });
  }
};

export const seedRecruitmentData = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const jobCount = await prisma.job.count({ where: { companyId } });
    if (jobCount > 0) {
      res.json({ message: 'Recruitment data already seeded' });
      return;
    }

    const mockJobs = [
      { title: 'Senior React Developer', description: 'Expert in React', department: 'Engineering', location: 'Remote', type: 'FULL_TIME', status: 'OPEN' },
      { title: 'VP of Marketing', description: 'Lead our marketing', department: 'Marketing', location: 'New York, NY', type: 'FULL_TIME', status: 'OPEN' },
      { title: 'Financial Analyst', description: 'Number cruncher', department: 'Finance', location: 'Chicago, IL', type: 'FULL_TIME', status: 'OPEN' },
      { title: 'Data Scientist', description: 'AI specialist', department: 'Engineering', location: 'Remote', type: 'FULL_TIME', status: 'CLOSED' },
    ];

    for (const jobData of mockJobs) {
      const job = await prisma.job.create({
        data: {
          companyId,
          ...jobData
        }
      });

      // Add a few candidates for each job
      const stages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
      for (let i = 0; i < 5; i++) {
        await prisma.candidate.create({
          data: {
            jobId: job.id,
            firstName: `Candidate${i}`,
            lastName: 'Demo',
            email: `candidate${i}@demo.com`,
            stage: stages[Math.floor(Math.random() * stages.length)] || 'APPLIED'
          }
        });
      }
    }

    getIO().emit('metrics-updated');

    res.json({ message: 'Successfully seeded recruitment data' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed recruitment data' });
  }
};
