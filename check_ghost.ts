import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const data = await prisma.inquirySettlement.findMany({
    where: {
      date: {
        contains: '2025-02-10'
      }
    }
  });

  console.log('Inquiry Settlement for 2025-02-10:');
  console.dir(data, { depth: null });

  process.exit(0);
}

main().catch(console.error);
