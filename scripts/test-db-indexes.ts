import dbPool from '../src/lib/mysql';

async function main() {
  try {
    const [rows]: any = await dbPool.execute('SHOW INDEXES FROM t_balju');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('DB Connection failed:', error.message);
    process.exit(1);
  }
}

main();
