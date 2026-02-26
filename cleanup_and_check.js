const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    // 1. 문제 데이터 삭제
    const deleted = await prisma.fixedSettlement.deleteMany({
      where: {
        name: {
          contains: '창원'
        }
      }
    });
    console.log(`Deleted ${deleted.count} problematic records.`);

    // 2. 전체 테이블 상태 확인
    const tables = [
      'billingItem',
      'billingRate',
      'gSSettlement',
      'gSSummary',
      'dailySummary',
      'emergencySettlement',
      'inquirySettlement',
      'emergencyRate',
      'fixedSettlement',
      'monthlyClosing'
    ];

    console.log('\n--- Current DB Status ---');
    for (const table of tables) {
      const count = await prisma[table].count();
      console.log(`${table}: ${count} records`);
    }

  } catch (e) {
    console.error('Cleanup/Check failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
