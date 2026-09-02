import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'adminportal@gmail.com';
  const password = 'Admin@123';
  const hashedPassword = await bcrypt.hash(password, 10);

  let role = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!role) {
    role = await prisma.role.create({
      data: { name: 'ADMIN', permissions: 'ALL' }
    });
  }

  let company = await prisma.company.findFirst({ where: { name: 'BusinessOS Admin' } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'BusinessOS Admin' }
    });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      roleId: role.id,
      companyId: company.id
    },
    create: {
      firstName: 'Super',
      lastName: 'Admin',
      email,
      password: hashedPassword,
      roleId: role.id,
      companyId: company.id
    }
  });

  console.log(`Admin user seeded: ${user.email}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
