const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkFinal() {
    try {
        console.log('--- [안팀장] 최종 스키마 및 접두사 규칙 점검 ---');

        const tables = await prisma.$queryRawUnsafe(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'prj_billing_to_client'
            ORDER BY table_name
        `);

        console.log('\n[Schema: prj_billing_to_client]');
        if (tables.length === 0) {
            console.log('테이블이 존재하지 않습니다.');
        } else {
            for (const t of tables) {
                const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "prj_billing_to_client"."${t.table_name}"`);
                console.log(`- ${t.table_name}: ${countRes[0].count}건`);
            }
        }

    } catch (e) {
        console.error('오류:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkFinal();
