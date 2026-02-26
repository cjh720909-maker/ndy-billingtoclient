const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restore() {
  try {
    const data = [
      {
        "id": "2787fc59-1fec-46ce-a979-58b76dfb377b",
        "name": "고정 차량(창원 등)",
        "billingRecipient": "KAM1팀",
        "amount": 2500000,
        "note": "월 고정",
        "createdAt": "2026-02-25T14:51:24.498Z",
        "count": 1, // Default count to 1
        "rate": 2500000 // Default rate to amount
      }
    ];

    for (const item of data) {
      await prisma.fixedSettlement.create({
        data: {
          id: item.id,
          name: item.name,
          billingRecipient: item.billingRecipient,
          amount: item.amount,
          count: item.count,
          rate: item.rate,
          note: item.note,
          createdAt: new Date(item.createdAt)
        }
      });
    }
    console.log('Restored 1 record.');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

restore();
