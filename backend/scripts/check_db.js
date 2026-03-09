import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const triggers = await prisma.$queryRaw `SHOW TRIGGERS LIKE 'narrative_captures'`;
        console.log("TRIGGERS:", triggers);
        // Get table schema
        const columns = await prisma.$queryRaw `SHOW COLUMNS FROM narrative_captures`;
        console.log("COLUMNS:", columns);
    }
    catch (e) {
        console.error(e);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=check_db.js.map