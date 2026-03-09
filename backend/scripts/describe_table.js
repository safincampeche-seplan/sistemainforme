import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function checkDb() {
    try {
        const tableInfo = await prisma.$queryRaw `DESCRIBE narrative_captures`;
        console.log("=== COLUMNAS REALES EN MYSQL ===");
        for (const row of tableInfo) {
            console.log(`- ${row.Field} (${row.Type})`);
        }
        const testSelect = await prisma.$queryRaw `SELECT * FROM narrative_captures LIMIT 1`;
        console.log("\n=== PRUEBA DE SELECT (RAW MYSQL) ===");
        console.log("SELECT LIMIT 1 exitoso.");
    }
    catch (e) {
        console.log("ERROR QUERYRAW:", e.message);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkDb();
//# sourceMappingURL=describe_table.js.map