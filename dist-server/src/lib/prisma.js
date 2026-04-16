import 'dotenv/config';
import localDb from './localDb.js';
let prisma;
if (process.env.DATABASE_URL) {
    try {
        const prismaClient = await import('@prisma/client');
        const prismaAdapter = await import('@prisma/adapter-mariadb');
        const mariadb = await import('mariadb');
        const PrismaClient = prismaClient.PrismaClient || prismaClient.default?.PrismaClient;
        const PrismaMariadb = prismaAdapter.PrismaMariadb || prismaAdapter.PrismaMariaDb || prismaAdapter.default?.PrismaMariadb;
        const pool = mariadb.createPool(process.env.DATABASE_URL);
        const adapter = new PrismaMariadb(pool);
        prisma = new PrismaClient({ adapter });
        console.log('[DB] Connected to MariaDB/MySQL');
    }
    catch (error) {
        console.warn('[DB] Failed to connect:', error.message);
        prisma = localDb;
    }
}
else {
    console.log('[DB] No DATABASE_URL — using local JSON storage');
    prisma = localDb;
}
export default prisma;
