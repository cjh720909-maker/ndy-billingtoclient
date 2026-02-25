import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Check if we have the LocalTestBalju table ready
  console.log("Setting up local test table 'LocalTestBalju'...");
  
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LocalTestBalju" (
      "id" SERIAL PRIMARY KEY,
      "B_DATE" VARCHAR(10) NOT NULL,
      "B_C_CODE" VARCHAR(50),
      "B_C_NAME" VARCHAR(100),
      "B_P_NO" VARCHAR(50),
      "B_P_NAME" VARCHAR(100),
      "B_QTY" DECIMAL(10,2),
      "B_IN_QTY" DECIMAL(10,2),
      "B_KG" DECIMAL(10,2),
      "B_MEMO" TEXT
    );
  `);

  // 2. Create the crucial index
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_local_b_date" ON "LocalTestBalju"("B_DATE");
  `);

  // 3. Generate 300,000 dummy rows spanning Jan 26 ~ Feb 25 if empty
  const count: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "LocalTestBalju"`);
  
  if (Number(count[0].cnt) < 100000) {
    console.log("Generating 300,000 rows of dummy data... (This may take a minute)");
    const stmt = `
      INSERT INTO "LocalTestBalju" 
      ("B_DATE", "B_C_CODE", "B_C_NAME", "B_QTY", "B_IN_QTY", "B_KG") 
      VALUES 
    `;
    
    const dates = [];
    const start = new Date('2025-01-26');
    for (let d = 0; d < 31; d++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + d);
      dates.push(dt.toISOString().split('T')[0]);
    }

    const batchSize = 10000;
    for (let i = 0; i < 30; i++) {
        let values = [];
        for (let j = 0; j < batchSize; j++) {
            const randomDate = dates[Math.floor(Math.random() * dates.length)];
            const isUrgent = Math.random() < 0.05 ? '긴급' : '';
            values.push(`('${randomDate}', 'C${j%100}', '테스트업체${j%100}${isUrgent}', ${Math.random()*10}, 2, ${Math.random()*50})`);
        }
        await prisma.$executeRawUnsafe(stmt + values.join(','));
        process.stdout.write(`Inserted ${((i+1)*batchSize).toLocaleString()} rows...\r`);
    }
    console.log("\nDummy data generated.");
  }

  console.log("\n--- PERFORMANCE TEST ---");
  console.log("Target Date Range: 2025-01-26 to 2025-02-25");

  // 4. Run the query on the local DB with INDEX
  console.log("\nTest 1: Running query on Local PostgreSQL (WITH Index)...");
  console.time("Query execution time");
  
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT "B_DATE", "B_C_CODE", "B_C_NAME", "B_QTY", "B_IN_QTY", "B_KG", "B_MEMO"
    FROM "LocalTestBalju"
    WHERE "B_DATE" >= '2025-01-26' AND "B_DATE" <= '2025-02-25'
  `);
  
  console.timeEnd("Query execution time");
  console.log(`Rows returned: ${result.length.toLocaleString()}`);

  // Test 2: In-memory loop simulation
  console.log("\nTest 2: Simulating JS memory loop (Filtering '긴급' & Aggregating)...");
  console.time("Javascript Loop Time");
  
  let matchCount = 0;
  let totalWeight = 0;
  
  result.forEach(row => {
    // Note: Local DB is UTF-8 so no iconv needed here, simulating pure JS logic speed
    const name = String(row.B_C_NAME || '');
    if (name.includes('긴급')) {
      matchCount++;
      totalWeight += Number(row.B_KG);
    }
  });

  console.timeEnd("Javascript Loop Time");
  console.log(`Urgent shipments found: ${matchCount.toLocaleString()}, Total KG: ${totalWeight.toFixed(2)}`);

  process.exit(0);
}

main().catch(console.error);
