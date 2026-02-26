const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function restoreFixedOnly() {
  try {
    const filePath = path.join(__dirname, 'data', 'fixed_settlements.json');
    if (fs.existsSync(filePath)) {
      const fixed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`Found ${fixed.length} items to restore.`);
      for (const item of fixed) {
        if (item.name && item.name.includes('창원')) {
          console.log(`Skipping: ${item.name}`);
          continue;
        }
        await prisma.fixedSettlement.create({
          data: {
            id: item.id,
            name: item.name,
            billingRecipient: item.billingRecipient || '',
            amount: item.amount,
            count: item.count || 1,
            rate: item.rate || item.amount,
            note: item.note || '',
            createdAt: new Date(item.createdAt)
          }
        });
        console.log(`Restored: ${item.name}`);
      }
    }
    console.log('Fixed restoration done.');
  } catch (e) {
    console.error('Failed to restore fixed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

restoreFixedOnly();
