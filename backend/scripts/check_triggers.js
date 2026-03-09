import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function checkTriggers() {
    try {
        const triggers = await prisma.$queryRaw `SHOW TRIGGERS LIKE 'narrative_captures'`;
        console.log("=== TRIGGERS EN narrative_captures ===");
        for (const t of triggers) {
            console.log(`\nTrigger: ${t.Trigger}\nEvent: ${t.Event}\nStatement: ${t.Statement}`);
        }
    }
    catch (e) {
        console.log("ERROR QUERYRAW:", e.message);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkTriggers();
//# sourceMappingURL=check_triggers.js.map