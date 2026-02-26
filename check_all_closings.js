const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const closings = await prisma.monthlyClosing.findMany({
      orderBy: { closedAt: 'desc' }
    });
    console.log(`Found ${closings.length} closings.`);
    const allFixed = new Map();
    closings.forEach(c => {
      const data = c.data;
      if (data && data.fixed) {
        data.fixed.forEach(f => {
          if (!allFixed.has(f.id)) {
            allFixed.set(f.id, f);
          }
        });
      }
    });
    console.log('Unique fixed costs across all closings:');
    console.log(JSON.stringify(Array.from(allFixed.values()), null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
