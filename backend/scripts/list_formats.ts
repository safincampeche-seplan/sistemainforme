import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const types = await prisma.cat_format_types.findMany();
    console.log(JSON.stringify(types, (key, value) => typeof value === 'bigint' ? value.toString() : value));
}
main().finally(() => prisma.$disconnect());
