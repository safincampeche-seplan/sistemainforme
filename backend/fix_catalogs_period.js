import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log("🛠️ Corrigiendo vínculos de periodo en los catálogos...");
    const period = await prisma.cat_narrative_periods.findFirst({ where: { year: '2026' } });
    if (!period)
        return console.log("No se halló el periodo 2026");
    console.log(`Periodo destino: ${period.id}`);
    // Update all Missions that are not linked to period 2026
    const missions = await prisma.mission.updateMany({
        where: { narrative_period_id: { not: period.id } },
        data: { narrative_period_id: period.id }
    });
    console.log(`Misiones corregidas: ${missions.count}`);
    // The rest of the tree (Titles, Themes, Subthemes) depends on Mission's period_id through the schema. 
    // Since Missions are now linked to Period 2026, the UI will fetch them correctly.
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=fix_catalogs_period.js.map