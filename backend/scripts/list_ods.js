import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const ods = await prisma.odsLinkage.findMany({ select: { id: true, name: true, code: true } });
    console.log(JSON.stringify(ods, (key, value) => typeof value === 'bigint' ? value.toString() : value));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=list_ods.js.map