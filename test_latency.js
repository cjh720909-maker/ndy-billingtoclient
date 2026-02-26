const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPerformance() {
  console.log('Starting DB latency test...');
  const start = Date.now();
  try {
    await prisma.$connect();
    console.log(`Connected in ${Date.now() - start}ms`);
    
    const startQuery = Date.now();
    await prisma.billingItem.count();
    console.log(`Query (count) took ${Date.now() - startQuery}ms`);

  } catch (e) {
    console.error('Performance test failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

testPerformance();
