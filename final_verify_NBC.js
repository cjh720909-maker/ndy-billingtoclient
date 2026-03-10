const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkFinal() {
    try {
        console.log('--- [안팀장] 최종 네이밍 규칙 및 테이블 격리 점검 ---');
        const dbInfo = await prisma.$queryRawUnsafe(`SELECT current_database(), current_schema(), session_user`);
        console.log('연결 정보:', JSON.stringify(dbInfo, null, 2));

        const schemas = await prisma.$queryRawUnsafe(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'prj_billing_to_client'
              AND table_name LIKE 'NBC_%'
            ORDER BY table_name
        `);

        console.log('\n[Schema: prj_billing_to_client | Prefix: NBC_]');
        if (schemas.length === 0) {
            console.log('NBC_ 접두사의 테이블이 존재하지 않습니다.');
        } else {
            console.log(`총 ${schemas.length}개의 테이블 확인됨`);
            for (const t of schemas) {
                const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "prj_billing_to_client"."${t.table_name}"`);
                console.log(`  - ${t.table_name}: ${countRes[0].count}건`);
            }
        }

    } catch (e) {
        console.error('검증 오류:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkFinal();
