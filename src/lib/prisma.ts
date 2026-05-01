import 'dotenv/config';
import localDb from './localDb';

let prisma: any;

if (process.env.DATABASE_URL) {
  try {
    const prismaClient: any = await import('@prisma/client');
    const prismaAdapter: any = await import('@prisma/adapter-mariadb');
    const mariadb = await import('mariadb');

    const PrismaClient = prismaClient.PrismaClient || prismaClient.default?.PrismaClient;
    const PrismaMariadb = prismaAdapter.PrismaMariadb || prismaAdapter.PrismaMariaDb || prismaAdapter.default?.PrismaMariadb;

    let dbUrl = process.env.DATABASE_URL!.replace(/^mysql:\/\//, 'mariadb://');
    if (!dbUrl.includes('?')) dbUrl += '?allowPublicKeyRetrieval=true';
    else dbUrl += '&allowPublicKeyRetrieval=true';
    
    const pool = mariadb.createPool(dbUrl);
    const adapter = new PrismaMariadb(pool);
    prisma = new PrismaClient({ adapter });

    console.log('[DB] Connected to MariaDB/MySQL');
  } catch (error: any) {
    console.warn('[DB] Failed to connect:', error.message);
    prisma = localDb;
  }
} else {
  console.log('[DB] No DATABASE_URL — using local JSON storage');
  prisma = localDb;
}

export default prisma;
