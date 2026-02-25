import dbPool from '../src/lib/mysql';

async function main() {
  try {
    const [rows]: any = await dbPool.execute('SELECT COUNT(*) as cnt FROM t_balju WHERE B_DATE >= ? AND B_DATE <= ? AND DAYOFWEEK(B_DATE) = 1', ['2025-01-26', '2025-02-25']);
    console.log('Jinju query success:', rows[0].cnt);
    process.exit(0);
  } catch (error) {
    console.error('DB Connection failed:', error.message);
    process.exit(1);
  }
}

main();
