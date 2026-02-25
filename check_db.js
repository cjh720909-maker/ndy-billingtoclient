const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const fixed = await prisma.fixedSettlement.findMany();
    console.log('Fixed Settlements:', JSON.stringify(fixed, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
