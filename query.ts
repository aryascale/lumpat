import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const evt = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (evt) {
    const about = (evt.content as any)?.about || '';
    console.log(about.substring(0, 500));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
