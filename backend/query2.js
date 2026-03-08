const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const deps = await prisma.cat_dependencies.findMany({ select: { id: true, name: true, dependency_axis: true }, take: 5 });
  console.log("Deps axis:", deps);
}
main().finally(() => prisma.$disconnect());
