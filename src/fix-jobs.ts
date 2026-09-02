import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.serviceRequest.findMany({
    where: { serviceType: 'Recruitment', status: { in: ['IN_PROGRESS', 'COMPLETED'] } }
  });

  for (const req of requests) {
    const existingJob = await prisma.job.findFirst({
      where: { companyId: req.companyId, description: { contains: req.id } }
    });

    if (!existingJob) {
      console.log(`Creating job for request ${req.id}`);
      await prisma.job.create({
        data: {
          companyId: req.companyId,
          title: `Requested Role: ${req.priority} Priority`,
          description: `${req.notes || 'No description provided.'}\n\nLinked to Request: ${req.id}`,
          department: 'Requested',
          location: 'TBD',
          type: 'FULL_TIME',
          status: 'OPEN'
        }
      });
    }
  }
  console.log("Done syncing jobs.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
