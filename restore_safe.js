const { PrismaClient } = require('@prisma/client');
console.log('script started');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
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
          update: {
            code: item.code || '',
            name: item.name,
            billingRecipient: item.billingRecipient || '',
            type: item.type || '기본운임',
            mergeCriteria: item.mergeCriteria || 'name',
            note: item.note || '',
            updatedAt: new Date(item.updatedAt)
          },
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
            update: {
              amount: rate.amount,
              validFrom: rate.validFrom,
              validTo: rate.validTo,
              note: rate.note || ''
            },
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
          await prisma.fixedSettlement.upsert({
            where: { id: item.id },
            update: {
              name: item.name,
              billingRecipient: item.billingRecipient || '',
              amount: item.amount,
              count: item.count || 1,
              rate: item.rate || item.amount,
              note: item.note || ''
            },
            create: {
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

    // 3. Daily Summary & GS Summary & Emergency & Inquiry
    // Special handling for unique keys
    const modelsWithUnique = [
      {
        file: 'daily_summaries.json',
        model: 'dailySummary',
        unique: 'DAILY_SUMMARY_UNIQUE',
        keys: ['startDate', 'endDate'],
        hasItems: true
      },
      {
        file: 'gs_summaries.json',
        model: 'gSSummary',
        unique: 'GS_SUMMARY_UNIQUE',
        keys: ['startDate', 'endDate']
      },
      {
        file: 'emergency_settlements.json',
        model: 'emergencySettlement',
        unique: 'EMERG_UNIQUE',
        keys: ['startDate', 'endDate', 'name']
      },
      {
        file: 'inquiry_settlements.json',
        model: 'inquirySettlement',
        unique: 'INQUIRY_UNIQUE',
        keys: ['startDate', 'endDate', 'date', 'name', 'so', 'nap', 'kum']
      }
    ];

    for (const config of modelsWithUnique) {
      console.log(`Restoring ${config.model} from ${config.file}...`);
      const filePath = path.join(dataDir, config.file);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const item of data) {
          const { id, items, ...rest } = item;

          let finalData = { ...rest };
          // Flatten nested summary for GSSummary
          if (config.model === 'gSSummary' && finalData.summary) {
            const { summary, ...others } = finalData;
            finalData = { ...others, ...summary };
          }

          // Filter out common extra fields found in JSON but not in DB
          if (config.model === 'inquirySettlement') {
            const { no, isRowSaved, savedId, ...valid } = finalData;
            finalData = valid;
          }
          if (config.model === 'emergencySettlement') {
            const { memo, ...valid } = finalData;
            finalData = valid;
          }


          // Determine where clause: use unique constraint if available, else fallback to id
          let whereClause = { id: id };
          if (config.unique && config.keys) {
            const uniqueSelector = {};
            config.keys.forEach(k => {
              uniqueSelector[k] = finalData[k];
            });
            whereClause = { [config.unique]: uniqueSelector };
          }

          await prisma[config.model].upsert({
            where: whereClause,
            update: {
              ...finalData,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
            },
            create: {
              ...finalData,
              id: id,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
            }
          });



          if (config.hasItems && Array.isArray(items)) {
            // Re-sync items for DailySummary
            await prisma.dailySummaryItem.deleteMany({ where: { summaryId: id } });
            await prisma.dailySummaryItem.createMany({
              data: items.map(itm => ({
                id: itm.id,
                summaryId: id,
                placeName: itm.placeName,
                deliveryDays: itm.deliveryDays,
                totalAmount: itm.totalAmount,
                deliveryDates: itm.deliveryDates
              }))
            });
          }
        }
      }
      console.log(`${config.model} restored.`);
    }

    // 4. GS Settlements (Special UUID + Unique Date/Code)
    if (fs.existsSync(path.join(dataDir, 'gs_settlements.json'))) {
      console.log('Restoring GS Settlements...');
      const gsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'gs_settlements.json'), 'utf8'));
      for (const id in gsData) {
        const item = gsData[id];
        const { isSaved, ...rest } = item;
        await prisma.gSSettlement.upsert({
          where: { id: id },
          update: rest,
          create: {
            ...rest,
            id: id
          }
        });
      }
      console.log('GS Settlements restored.');
    }


    // 5. Emergency Rates
    if (fs.existsSync(path.join(dataDir, 'emergency_rates.json'))) {
      console.log('Restoring Emergency Rates...');
      const rates = JSON.parse(fs.readFileSync(path.join(dataDir, 'emergency_rates.json'), 'utf8'));
      for (const name in rates) {
        const rate = rates[name];
        await prisma.emergencyRate.upsert({
          where: { name: name },
          update: { rate: rate, chung: '' },
          create: { name: name, rate: rate, chung: '' }
        });
      }
      console.log('Emergency Rates restored.');
    }


    console.log('Safe restoration successful.');
  } catch (e) {
    console.error('Safe restoration failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

restoreSafe();
