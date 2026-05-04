import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as mariadbPkg from 'mariadb';
import 'dotenv/config';
console.log('[Prisma] Module loaded');
const prismaClientSingleton = () => {
    console.log('[Prisma] Creating singleton...');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl)
        throw new Error('DATABASE_URL environment variable is missing');
    // Manual parsing for guaranteed results
    // Format: mysql://user:pass@host:port/db
    const regex = /^mysql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/;
    const match = dbUrl.match(regex);
    if (!match)
        throw new Error('Invalid DATABASE_URL format. Expected: mysql://user:pass@host:port/db');
    const [, user, password, host, portStr, database] = match;
    const port = portStr ? parseInt(portStr) : 3306;
    console.log(`[Prisma] Connecting to ${host}:${port} as ${user} (Manual Parse)`);
    const config = {
        host,
        port,
        user,
        password,
        database,
        allowPublicKeyRetrieval: true,
        connectionLimit: 10,
        connectTimeout: 10000,
    };
    const mariadb = mariadbPkg;
    const createPool = mariadb.createPool || mariadb.default?.createPool;
    if (!createPool)
        throw new Error('MariaDB driver not found');
    const pool = createPool(config);
    const adapter = new PrismaMariaDb(pool);
    return new PrismaClient({
        // @ts-ignore
        adapter,
        log: ['query', 'error', 'warn'],
    });
};
const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();
export default prisma;
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
