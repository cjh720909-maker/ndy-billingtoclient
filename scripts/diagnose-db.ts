
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MYSQL_URL = process.env.MYSQL_URL;

async function diagnose() {
  if (!MYSQL_URL) {
    console.error('MYSQL_URL not found in .env');
    process.exit(1);
  }

  const connection = await mysql.createConnection(MYSQL_URL);

  try {
    console.log('\n--- Explain t_balju query with CONVERT and Date Range ---');
    const [explain]: any = await connection.execute(`
      EXPLAIN SELECT B_DATE, B_C_NAME 
      FROM t_balju 
      WHERE B_DATE >= '2026-02-01' AND B_DATE <= '2026-02-28'
      AND CONVERT(B_C_NAME USING utf8mb4) LIKE '%긴급%'
    `);
    console.table(explain);

    const start = Date.now();
    const [rows]: any = await connection.execute(`
      SELECT B_DATE, B_C_NAME 
      FROM t_balju 
      WHERE B_DATE >= '2026-02-01' AND B_DATE <= '2026-02-28'
      AND CONVERT(B_C_NAME USING utf8mb4) LIKE '%긴급%'
      LIMIT 10
    `);
    console.log(`Query took ${Date.now() - start}ms. Found ${rows.length} rows.`);

  } catch (err) {
    console.error('Diagnosis failed:', err);
  } finally {
    await connection.end();
  }
}

diagnose();
