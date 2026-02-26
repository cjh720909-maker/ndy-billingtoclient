const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const closings = await prisma.monthlyClosing.findMany({
      orderBy: { closedAt: 'desc' },
      take: 1
    });
    if (closings.length > 0) {
      console.log('Found closing from:', closings[0].closedAt);
      const data = closings[0].data;
      if (data && data.fixed) {
        console.log('Fixed costs in closing:', JSON.stringify(data.fixed, null, 2));
      } else {
        console.log('No fixed costs found in the latest closing.');
      }
    } else {
      console.log('No monthly closings found.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
