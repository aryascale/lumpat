const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const events = await prisma.event.findMany({
    select: { id: true, name: true, bannerUrl: true }
  });
  console.log(JSON.stringify(events, null, 2));
}
main();
