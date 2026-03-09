import { PrismaClient, narrative_captures_status } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const periods = await prisma.cat_narrative_periods.findMany();
    console.log(JSON.stringify(periods, (key, value) => typeof value === 'bigint' ? value.toString() : value));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=list_periods.js.map