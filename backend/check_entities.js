import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function checkEntities() {
    try {
        console.log("--- ENTIDADES EN DB ---");
        const entities = await prisma.entity.findMany({
            include: { properties: true }
        });
        console.log(`Total entidades: ${entities.length}`);
        entities.forEach((e) => {
            console.log(`  ID: ${e.id}, Name: ${e.name}, Properties: ${e.properties.length}`);
            e.properties.forEach((p) => {
                console.log(`    PropID: ${p.id}, Name: ${p.column_name}, Type: ${p.column_type}`);
            });
        });
    }
    catch (e) {
        console.error("Error:", e);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkEntities();
//# sourceMappingURL=check_entities.js.map