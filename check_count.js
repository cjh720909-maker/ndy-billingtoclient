const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.fixedSettlement.count().then(c => { console.log('FixedCount:', c); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
