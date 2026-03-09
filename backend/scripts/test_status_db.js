import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    try {
        const selectedYear = '2026';
        const period = await prisma.cat_narrative_periods.findFirst({
            where: { year: selectedYear }
        });
        const periodId = period?.id;
        console.log("Period ID:", periodId);
        const narrativeCount = periodId ? await prisma.narrativeCapture.count({
            where: { narrative_period_id: periodId }
        }) : 0;
        console.log("Narratives:", narrativeCount);
        const approvedNarrativeCount = periodId ? await prisma.narrativeCapture.count({
            where: { narrative_period_id: periodId, status: { in: ['approved_secont', 'finished'] } }
        }) : 0;
        console.log("Approved Narratives:", approvedNarrativeCount);
        const entityCount = await prisma.entity.count();
        console.log("Entities:", entityCount);
        const entryPeriodRecord = await prisma.cat_periods.findFirst({ where: { name: selectedYear } });
        console.log("Entry Period Record:", entryPeriodRecord?.id);
        const capturedEntityCount = entryPeriodRecord ? await prisma.entry.count({
            where: { period_id: entryPeriodRecord.id }
        }) : 0;
        console.log("Captured:", capturedEntityCount);
        const titles = await prisma.narrativeTitle.findMany({ take: 10 });
        console.log("Titles length:", titles.length);
        const titlesLen = Math.max(1, titles.length);
        const axes = titles.map((t) => ({
            id: t.id,
            name: t.name,
            total: narrativeCount > 0 ? Math.ceil(narrativeCount / titlesLen) : 0,
            approved: approvedNarrativeCount > 0 ? Math.ceil(approvedNarrativeCount / titlesLen) : 0
        }));
        const statsProgress = {
            totalEntities: entityCount || 0,
            capturedEntities: capturedEntityCount || 0,
            validatedEntities: 0
        };
        console.log("SUCCESS!");
    }
    catch (e) {
        console.error("FAIL:", e);
    }
}
run();
//# sourceMappingURL=test_status_db.js.map