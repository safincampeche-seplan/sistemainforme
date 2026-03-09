import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const deps = await prisma.dependency.findMany({ select: { id: true, name: true } });
    console.log(JSON.stringify(deps, (key, value) => typeof value === 'bigint' ? value.toString() : value));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=list_deps.js.map