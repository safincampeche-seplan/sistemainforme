import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const counts = await Promise.all([
        prisma.narrativeCapture.count(),
        prisma.cat_objectives.count(),
        prisma.entity.count(),
        prisma.budgetProgram.count(),
        prisma.mission.count(),
        prisma.narrativeTitle.count(),
        prisma.narrativeTheme.count(),
        prisma.cat_narrative_sub_themes.count(),
        prisma.cat_narrative_periods.count()
    ]);

    console.log(JSON.stringify({
        narrativeCaptures: counts[0],
        objectives: counts[1],
        entities: counts[2],
        budgetPrograms: counts[3],
        missions: counts[4],
        titles: counts[5],
        themes: counts[6],
        subThemes: counts[7],
        periods: counts[8]
    }, null, 2));
}
main().finally(() => prisma.$disconnect());
