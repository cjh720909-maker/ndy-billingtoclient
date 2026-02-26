const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function restoreRemaining() {
  try {
    const dataDir = path.join(__dirname, 'data');
    
    // 2. Daily Summary (Exclude items if needed, but usually daily items are fine)
    if (fs.existsSync(path.join(dataDir, 'daily_summaries.json'))) {
      const daily = JSON.parse(fs.readFileSync(path.join(dataDir, 'daily_summaries.json'), 'utf8'));
      for (const summary of daily) {
        await prisma.dailySummary.create({
          data: {
            id: summary.id,
            startDate: summary.startDate,
            endDate: summary.endDate,
            createdAt: new Date(summary.createdAt),
            updatedAt: new Date(summary.updatedAt),
            items: {
              create: summary.items.map(item => ({
                placeName: item.placeName,
                deliveryDays: item.deliveryDays,
                totalAmount: item.totalAmount,
                deliveryDates: item.deliveryDates || []
              }))
            }
          }
        });
      }
      console.log('Daily Summary restored.');
    }

    // 3. GS Summary
    if (fs.existsSync(path.join(dataDir, 'gs_summaries.json'))) {
      const gs = JSON.parse(fs.readFileSync(path.join(dataDir, 'gs_summaries.json'), 'utf8'));
      for (const summary of gs) {
        await prisma.gSSummary.create({
          data: {
            id: summary.id,
            startDate: summary.startDate,
            endDate: summary.endDate,
            weekday: summary.weekday,
            saturday: summary.saturday,
            sunday: summary.sunday,
            extraTrucks: summary.extraTrucks,
            totalAmount: summary.totalAmount,
            dates: summary.dates || [],
            createdAt: new Date(summary.createdAt),
            updatedAt: new Date(summary.updatedAt)
          }
        });
      }
      console.log('GS Summary restored.');
    }

    // 4. Emergency Settlements
    if (fs.existsSync(path.join(dataDir, 'emergency_settlements.json'))) {
      const emergency = JSON.parse(fs.readFileSync(path.join(dataDir, 'emergency_settlements.json'), 'utf8'));
      for (const s of emergency) {
        await prisma.emergencySettlement.create({
          data: {
            id: s.id,
            startDate: s.startDate,
            endDate: s.endDate,
            name: s.name,
            chung: s.chung || '',
            count: s.count,
            rate: s.rate,
            total: s.total,
            dates: s.dates || [],
            createdAt: new Date(s.createdAt)
          }
        });
      }
      console.log('Emergency Settlements restored.');
    }

    // 5. Inquiry Settlements
    if (fs.existsSync(path.join(dataDir, 'inquiry_settlements.json'))) {
      const inquiry = JSON.parse(fs.readFileSync(path.join(dataDir, 'inquiry_settlements.json'), 'utf8'));
      for (const s of inquiry) {
        await prisma.inquirySettlement.create({
          data: {
            id: s.id,
            startDate: s.startDate,
            endDate: s.endDate,
            date: s.date,
            name: s.name,
            so: s.so,
            nap: s.nap,
            ton: s.ton || '',
            kum: s.kum,
            yo: s.yo || '',
            chung: s.chung || '',
            un: s.un || 0,
            memo: s.memo || '',
            createdAt: new Date(s.createdAt)
          }
        });
      }
      console.log('Inquiry Settlements restored.');
    }

  } catch (e) {
    console.error('Restoration failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

restoreRemaining();
