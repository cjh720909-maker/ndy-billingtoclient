require('dotenv').config();
const mysql = require('mysql2/promise');
const iconv = require('iconv-lite');

async function run() {
  // connection string: mysql://user:pass@host:port/db
  const connection = await mysql.createConnection(process.env.MYSQL_URL);
  
  // charset latin1로 설정해서 원본 바이트 그대로 가져오기 시도 (필요한 경우)
  await connection.query("SET NAMES 'latin1'"); 

  const [rows] = await connection.execute('SELECT B_C_NAME FROM t_balju WHERE B_C_NAME IS NOT NULL LIMIT 5');
  
  rows.forEach((row, i) => {
    const raw = row.B_C_NAME;
    const buf = Buffer.from(raw, 'binary');
    const decoded = iconv.decode(buf, 'euckr');
    console.log(`Row ${i} Raw:`, raw);
    console.log(`Row ${i} Decoded (EUC-KR):`, decoded);
  });

  await connection.end();
}
run().catch(console.error);
