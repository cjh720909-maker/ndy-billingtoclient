import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { mysql: PrismaClient };

export const mysql =
  globalForPrisma.mysql ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.mysql = mysql;
