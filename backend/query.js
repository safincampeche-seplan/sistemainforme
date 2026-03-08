const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const sectors = await prisma.cat_sectors.findMany();
  console.log("Sectors:", sectors);
  const missions = await prisma.mission.findMany().catch(() => prisma.cat_narrative_missions.findMany());
  console.log("Missions:", missions);
}
main().finally(() => prisma.$disconnect());
