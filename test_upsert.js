const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testRestore() {
    try {
        console.log('[안팀장] 테스트 스크립트 실행 시작');

        // 간단한 쿼리 테스트
        const res = await prisma.$queryRawUnsafe(`SELECT 1`);
        console.log('기본 쿼리 통과:', res);

        console.log('BillingItem 테이블 카운트 시도...');
        const count = await prisma.billingItem.count();
        console.log('현재 BillingItem 수:', count);

        console.log('Upsert 테스트 진행...');
        await prisma.billingItem.upsert({
            where: { id: 'test-id-123' },
            update: { name: 'Test', type: 'Test' },
            create: { id: 'test-id-123', name: 'Test', type: 'Test' }
        });
        console.log('Upsert 성공');

    } catch (e) {
        console.error('오류:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testRestore();
