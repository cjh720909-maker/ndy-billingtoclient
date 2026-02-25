import dbPool from '../src/lib/mysql';

async function main() {
  try {
    const [rows]: any = await dbPool.execute('SHOW INDEXES FROM t_balju');
    console.log('Indexes on t_balju:', rows);
    process.exit(0);
  } catch (error) {
    console.error('DB Connection failed:', error);
    process.exit(1);
  }
}

main();
