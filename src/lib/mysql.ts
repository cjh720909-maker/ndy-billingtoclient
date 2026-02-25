import mysql from 'mysql2/promise';

/**
 * 전역 MySQL 커넥션 풀 인스턴스
 * 매번 새로운 연결을 생성하는 오버헤드를 줄여 성능을 개선합니다.
 */
const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 5000,
});

export default pool;
