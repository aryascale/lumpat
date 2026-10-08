import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL!;
// Original regex (requires password):
// const regex = /^mysql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/;
// Modified regex (allows empty password AND omitted colon):
const regex = /^mysql:\/\/([^:@]+)(?::([^@]*))?@([^:/]+)(?::(\d+))?\/([^?]+)/;
const match = dbUrl.match(regex);

if (!match) throw new Error('Invalid DATABASE_URL');

const [, user, password, host, portStr, database] = match;

export const pool = mysql.createPool({
  host,
  port: parseInt(portStr || '3306'),
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00'
});

export async function query(sql: string, params: any[] = []): Promise<any[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as any[];
}

/** UPDATE/DELETE — returns affectedRows, for compare-and-set guards. */
export async function exec(sql: string, params: any[] = []): Promise<number> {
  const [result] = await pool.execute(sql, params);
  return (result as any).affectedRows ?? 0;
}

/** Run fn inside a transaction on one pooled connection; q is connection-bound. */
export async function withTx<T>(fn: (q: (sql: string, params?: any[]) => Promise<any>) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn((sql, params = []) => conn.execute(sql, params).then(([r]: any) => r));
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
