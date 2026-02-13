const mysql = require('mysql2/promise');
const iconv = require('iconv-lite');
require('dotenv').config();

async function checkData() {
  const connection = await mysql.createConnection(process.env.MYSQL_URL);
  await connection.query("SET NAMES 'latin1'");

  // 2026-02-11 데이터와 상품 테이블 조인 확인
  const [rows] = await connection.execute(`
    SELECT 
      b.B_DATE, b.B_C_CODE, b.B_C_NAME, b.B_P_NO, b.B_P_NAME, b.B_IN_QTY, b.B_QTY, p.P_IPSU
    FROM t_balju b
    LEFT JOIN t_product p ON b.B_P_NO = p.P_CODE
    WHERE b.B_DATE = "2026-02-11" AND b.B_C_CODE IN ("1114428", "1109972")
    LIMIT 20
  `);

  const decode = (val) => {
    if (!val) return '';
    return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
  };

  const results = rows.map(r => ({
    date: r.B_DATE,
    code: r.B_C_CODE,
    name: decode(r.B_C_NAME),
    p_no: r.B_P_NO,
    p_name: decode(r.B_P_NAME),
    qty: Number(r.B_QTY),
    in_qty: Number(r.B_IN_QTY),
    ipsu: r.P_IPSU
  }));

  console.log(JSON.stringify(results, null, 2));
  await connection.end();
}

checkData();
