import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const user = await prisma.user.upsert({
    where: { userId: 'DOC001' },
    update: {},
    create: {
      userId: 'DOC001',
      firstName: 'John',
      lastName: 'Doe',
      role: Role.PHYSICIAN,
      passwordHash: passwordHash,
      isActive: true,
      mustResetPassword: false,
    },
  });

  console.log('Seeded test user:', user.userId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });