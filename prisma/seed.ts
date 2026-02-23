import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function readJson(filename: string) {
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Could not read ${filename}`);
    return null;
  }
}

async function main() {
  console.log('Starting migration from JSON to DB...');

  // 1. Billing Items & Rates
  const billingData = await readJson('billing.json');
  if (billingData?.items) {
    console.log(`Migrating ${billingData.items.length} billing items...`);
    for (const item of billingData.items) {
      await prisma.billingItem.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          code: item.code || '',
          name: item.name,
          billingRecipient: item.billingRecipient || '',
          mergeCriteria: item.mergeCriteria || 'name',
          note: item.note || '',
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
          rates: {
            create: item.rates.map((r: any) => ({
              id: r.id,
              validFrom: r.validFrom,
              validTo: r.validTo,
              amount: r.amount,
              note: r.note || '',
              createdAt: new Date(r.createdAt)
            }))
          }
        }
      });
    }
  }

  // 2. GS Settlements
  const gsSettlements = await readJson('gs_settlements.json');
  if (gsSettlements) {
    const entries = Object.values(gsSettlements);
    console.log(`Migrating ${entries.length} GS settlements...`);
    for (const entry of entries as any[]) {
      await prisma.gSSettlement.upsert({
        where: {
          GS_UNIQUE: {
            date: entry.date,
            code: entry.code
          }
        },
        update: {},
        create: {
          date: entry.date,
          code: entry.code,
          name: entry.name,
          qty: entry.qty,
          weight: entry.weight,
          amount: entry.amount,
          remarks: entry.remarks || '',
          modDate: new Date(entry.modDate)
        }
      });
    }
  }

  // 3. GS Summaries
  const gsSummaries = await readJson('gs_summaries.json');
  if (gsSummaries) {
    console.log(`Migrating ${gsSummaries.length} GS summaries...`);
    for (const s of gsSummaries as any[]) {
      await prisma.gSSummary.upsert({
        where: {
          GS_SUMMARY_UNIQUE: {
            startDate: s.startDate,
            endDate: s.endDate
          }
        },
        update: {},
        create: {
          startDate: s.startDate,
          endDate: s.endDate,
          weekday: s.summary.weekday,
          saturday: s.summary.saturday,
          sunday: s.summary.sunday,
          extraTrucks: s.summary.extraTrucks,
          totalAmount: s.summary.totalAmount,
          dates: s.summary.dates || []
        }
      });
    }
  }

  // 4. Daily Summaries
  const dailySummaries = await readJson('daily_summaries.json');
  if (dailySummaries) {
    console.log(`Migrating ${dailySummaries.length} daily summaries...`);
    for (const s of dailySummaries as any[]) {
      // 기간별 중복 방지
      const existing = await prisma.dailySummary.findFirst({
        where: { startDate: s.startDate, endDate: s.endDate }
      });
      if (existing) continue;

      await prisma.dailySummary.create({
        data: {
          startDate: s.startDate,
          endDate: s.endDate,
          items: {
            create: s.items.map((item: any) => ({
              placeName: item.placeName,
              deliveryDays: item.deliveryDays,
              totalAmount: item.totalAmount,
              deliveryDates: item.deliveryDates || []
            }))
          }
        }
      });
    }
  }

  // 5. Emergency Settlements
  const emergencySettlements = await readJson('emergency_settlements.json');
  if (emergencySettlements) {
    console.log(`Migrating ${emergencySettlements.length} emergency settlements...`);
    for (const s of emergencySettlements as any[]) {
      await prisma.emergencySettlement.upsert({
        where: {
          EMERG_UNIQUE: {
            startDate: s.startDate,
            endDate: s.endDate,
            name: s.name
          }
        },
        update: {
          count: s.count,
          rate: s.rate,
          total: s.total,
          dates: s.dates || []
        },
        create: {
          startDate: s.startDate,
          endDate: s.endDate,
          name: s.name,
          count: s.count,
          rate: s.rate,
          total: s.total,
          dates: s.dates || []
        }
      });
    }
  }

  // 6. Emergency Rates
  const emergencyRates = await readJson('emergency_rates.json');
  if (emergencyRates) {
    const entries = Object.entries(emergencyRates);
    console.log(`Migrating ${entries.length} emergency rates...`);
    for (const [name, rate] of entries) {
      await prisma.emergencyRate.upsert({
        where: { name },
        update: { rate: rate as number },
        create: { name, rate: rate as number }
      });
    }
  }

  // 7. Fixed Settlements
  const fixedSettlements = await readJson('fixed_settlements.json');
  if (fixedSettlements) {
    console.log(`Migrating ${fixedSettlements.length} fixed settlements...`);
    for (const s of fixedSettlements as any[]) {
      await prisma.fixedSettlement.upsert({
        where: { id: s.id },
        update: {
          name: s.name,
          amount: s.amount,
          note: s.memo || s.note
        },
        create: {
          id: s.id,
          name: s.name,
          amount: s.amount,
          note: s.memo || s.note,
          createdAt: new Date(s.createdAt)
        }
      });
    }
  }

  // 8. Inquiry Settlements
  const inquirySettlements = await readJson('inquiry_settlements.json');
  if (inquirySettlements) {
    console.log(`Migrating ${inquirySettlements.length} inquiry settlements...`);
    for (const s of inquirySettlements as any[]) {
      await prisma.inquirySettlement.upsert({
        where: {
          INQUIRY_UNIQUE: {
            startDate: s.startDate,
            endDate: s.endDate,
            date: s.date,
            name: s.name,
            so: s.so,
            nap: s.nap,
            kum: s.kum
          }
        },
        update: {},
        create: {
          startDate: s.startDate,
          endDate: s.endDate,
          date: s.date,
          name: s.name,
          so: s.so,
          nap: s.nap,
          ton: s.ton,
          kum: s.kum,
          yo: s.yo,
          chung: s.chung,
          un: s.un,
          memo: s.memo
        }
      });
    }
  }

  // 9. Config
  const config = await readJson('config.json');
  if (config) {
    console.log('Migrating config...');
    for (const [key, data] of Object.entries(config)) {
      await prisma.config.upsert({
        where: { key },
        update: { data: data as any },
        create: { key, data: data as any }
      });
    }
  }

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
