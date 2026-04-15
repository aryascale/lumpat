import 'dotenv/config';
import localDb from './localDb';

let prisma: any;

if (process.env.DATABASE_URL) {
  // Production: use real Prisma + MariaDB
  // Dynamic import to avoid crashing when @prisma/client is not generated
  try {
    const prismaClient = await import('@prisma/client');
    const prismaAdapter = await import('@prisma/adapter-mariadb');
    const mariadb = await import('mariadb');

    const PrismaClient = prismaClient.PrismaClient || (prismaClient as any).default?.PrismaClient;
    const PrismaMariadb = prismaAdapter.PrismaMariadb || (prismaAdapter as any).PrismaMariaDb || (prismaAdapter as any).default?.PrismaMariadb;

    const pool = mariadb.createPool(process.env.DATABASE_URL!);
    const adapter = new PrismaMariadb(pool);
    prisma = new PrismaClient({ adapter });

    console.log('[DB] Connected to MariaDB/MySQL');
  } catch (error: any) {
    console.warn('[DB] Failed to connect to database:', error.message);
    console.warn('[DB] Falling back to local JSON file storage');
    prisma = localDb;
  }
} else {
  // Local development: use JSON-file-based database
  console.log('[DB] No DATABASE_URL found — using local JSON file storage');
  prisma = localDb;
}

export default prisma;
