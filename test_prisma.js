const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Testing connection...');
        const res = await prisma.$queryRawUnsafe(`SELECT 1`);
        console.log('Connection OK:', res);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}
test();
