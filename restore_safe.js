const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function restoreSafe() {
  try {
    const dataDir = path.join(__dirname, 'data');
    console.log('Starting safe restoration from:', dataDir);

    // 1. Billing Items
    console.log('Restoring Billing Items...');
    if (fs.existsSync(path.join(dataDir, 'billing.json'))) {
      const billing = JSON.parse(fs.readFileSync(path.join(dataDir, 'billing.json'), 'utf8'));
      for (const item of billing.items) {
        if (item.name && item.name.includes('창원') && item.name.includes('냉동')) {
          console.log(`  Skipping billing item: ${item.name}`);
          continue;
        }
        await prisma.billingItem.upsert({
          where: { id: item.id },
          update: {},
          create: {
            id: item.id,
            code: item.code || '',
            name: item.name,
            billingRecipient: item.billingRecipient || '',
            type: item.type || '기본운임',
            mergeCriteria: item.mergeCriteria || 'name',
            note: item.note || '',
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt)
          }
        });
        for (const rate of item.rates) {
          await prisma.billingRate.upsert({
            where: { id: rate.id },
            update: {},
            create: {
              id: rate.id,
              itemId: rate.itemId,
              validFrom: rate.validFrom,
              validTo: rate.validTo,
              amount: rate.amount,
              note: rate.note || '',
              createdAt: new Date(rate.createdAt)
            }
          });
        }
      }
    }
    console.log('Billing Items restored.');

    // 2. Fixed Settlements
    console.log('Restoring Fixed Settlements...');
    if (fs.existsSync(path.join(dataDir, 'fixed_settlements.json'))) {
      const content = fs.readFileSync(path.join(dataDir, 'fixed_settlements.json'), 'utf8');
      if (content.trim() !== '[]' && content.trim() !== '') {
        const fixed = JSON.parse(content);
        for (const item of fixed) {
          if (item.name && item.name.includes('창원')) {
            console.log(`  Skipping fixed settlement: ${item.name}`);
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
        }
      }
    }
    console.log('Fixed Settlements restored.');

    // 3. Other Summaries & Settlements
    const files = [
      { name: 'daily_summaries.json', model: 'dailySummary' },
      { name: 'gs_summaries.json', model: 'gSSummary' },
      { name: 'emergency_settlements.json', model: 'emergencySettlement' },
      { name: 'inquiry_settlements.json', model: 'inquirySettlement' }
    ];

    for (const f of files) {
      console.log(`Restoring ${f.model} from ${f.name}...`);
      const filePath = path.join(dataDir, f.name);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data)) {
          for (const item of data) {
            const { id, ...rest } = item;
            await prisma[f.model].create({
              data: {
                ...rest,
                id: id,
                createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
                updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
              }
            });
          }
        }
      }
      console.log(`${f.model} restored.`);
    }

    // 4. Emergency Rates
    if (fs.existsSync(path.join(dataDir, 'emergency_rates.json'))) {
      const rates = JSON.parse(fs.readFileSync(path.join(dataDir, 'emergency_rates.json'), 'utf8'));
      for (const r of rates) {
        await prisma.emergencyRate.upsert({
          where: { name: r.name },
          update: { rate: r.rate, chung: r.chung || '' },
          create: { name: r.name, rate: r.rate, chung: r.chung || '' }
        });
      }
    }

    console.log('Safe restoration successful.');
  } catch (e) {
    console.error('Safe restoration failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSafe();
