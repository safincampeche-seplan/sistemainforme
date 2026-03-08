import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const deps = await prisma.dependency.findMany({ select: { id: true, name: true, dependency_axis: true }, take: 10 });
    console.log("Deps axis:");
    console.dir(deps, { depth: null });
}
main().finally(() => prisma.$disconnect());
