const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkLocks() {
    try {
        console.log('--- DB Locks Check ---');
        const locks = await prisma.$queryRawUnsafe(`
            SELECT pid, state, query, wait_event_type, wait_event 
            FROM pg_stat_activity 
            WHERE state != 'idle' AND pid != pg_backend_pid();
        `);
        console.log(locks);

        // Terminate any blocked queries
        for (const l of locks) {
            console.log(`Killing PID ${l.pid} (query: ${l.query.substring(0, 50)}...)`);
            await prisma.$queryRawUnsafe(`SELECT pg_terminate_backend(${l.pid})`);
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
checkLocks();
