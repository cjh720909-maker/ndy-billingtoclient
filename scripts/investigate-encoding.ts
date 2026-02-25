
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import path from 'path';
import iconv from 'iconv-lite';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MYSQL_URL = process.env.MYSQL_URL;

async function diagnose() {
  if (!MYSQL_URL) {
    console.error('MYSQL_URL not found in .env');
    process.exit(1);
  }

  const connection = await mysql.createConnection(MYSQL_URL);

  try {
    const startDate = '2025-01-01';
    const endDate = '2025-01-31';

    console.log('\n--- Testing CONVERT(... USING euckr) ---');
    try {
      const [rows]: any = await connection.execute(`
        SELECT B_C_NAME 
        FROM t_balju 
        WHERE B_DATE >= ? AND B_DATE <= ? 
        AND CONVERT(B_C_NAME USING euckr) LIKE '%김해%'
        LIMIT 5
      `, [startDate, endDate]);
      console.log(`Found ${rows.length} rows with CONVERT(... USING euckr).`);
    } catch (e: any) {
      console.log('CONVERT(... USING euckr) failed:', e.message);
    }

    console.log('\n--- Testing HEX/UNHEX Search ---');
    const kimhaeHex = iconv.encode('김해', 'euckr').toString('hex');
    const [hexRows]: any = await connection.execute(`
      SELECT B_C_NAME 
      FROM t_balju 
      WHERE B_DATE >= ? AND B_DATE <= ? 
      AND HEX(B_C_NAME) LIKE ?
      LIMIT 5
    `, [startDate, endDate, `%${kimhaeHex.toUpperCase()}%`]);
    console.log(`Found ${hexRows.length} rows with HEX search.`);

    console.log('\n--- Testing with _latin1 introducer ---');
    const encodedKimhae = iconv.encode('김해', 'euckr').toString('binary');
    const [latRows]: any = await connection.execute(`
      SELECT B_C_NAME 
      FROM t_balju 
      WHERE B_DATE >= ? AND B_DATE <= ? 
      AND B_C_NAME LIKE _latin1 ?
      LIMIT 5
    `, [startDate, endDate, `%${encodedKimhae}%`]);
    console.log(`Found ${latRows.length} rows with _latin1 search.`);

  } catch (err) {
    console.error('Diagnosis failed:', err);
  } finally {
    await connection.end();
  }
}

diagnose();
