import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const items = await prisma.billingItem.findMany();
    console.log('--- Billing Items ---');
    console.log(JSON.stringify(items.map(i => ({ name: i.name, billingRecipient: i.billingRecipient })), null, 2));
    
    // Check some inquiry records as well
    const lastSummary = await prisma.inquirySettlement.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    });
    console.log('--- Recent Inquiry Settlements ---');
    console.log(JSON.stringify(lastSummary.map(s => ({ nap: s.nap, chung: s.chung, so: s.so })), null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
