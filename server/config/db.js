const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pharmqms',
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      timezone: 'Z',
      dateStrings: true
    });
  }

  return pool;
}

async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function getConnection() {
  return getPool().getConnection();
}

async function ping() {
  let connection;
  try {
    connection = await getPool().getConnection();
    await connection.ping();
  } catch (error) {
    const wrapped = new Error(error.message || 'MySQL connection failed');
    wrapped.code = error.code;
    wrapped.cause = error;
    throw wrapped;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  getPool,
  query,
  getConnection,
  ping
};
