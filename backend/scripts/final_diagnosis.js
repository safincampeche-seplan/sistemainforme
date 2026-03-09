import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Final Diagnosis ---');
    const year = '2026';
    // 1. Check Period
    const period = await p.cat_narrative_periods.findFirst({ where: { year, deleted_at: null } });
    console.log('Active 2026 Period ID:', period ? period.id.toString() : 'NONE');
    if (!period)
        return;
    // 2. Check Titles for either ID 1 or the found ID
    const titles = await p.narrativeTitle.findMany({
        where: { cat_missions: { narrative_period_id: period.id } }
    });
    console.log('Titles found for this period:', titles.length);
    if (titles.length === 0) {
        // Maybe the relation name is different in the where clause?
        const sampleTitle = await p.narrativeTitle.findFirst({
            include: { cat_missions: true }
        });
        console.log('Sample Title structure:', JSON.stringify(sampleTitle, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    }
    // 3. Check Themes (Implicitly)
    const themes = await p.narrativeTheme.findMany({
        where: { title: { cat_missions: { narrative_period_id: period.id } } },
        take: 2
    });
    console.log('Themes found for this period via Title->Mission relation:', themes.length);
    // 4. Check for ignored models
    console.log('Checking model existence in client:');
    console.log('p.cat_narrative_financing_sources:', !!p.cat_narrative_financing_sources);
    console.log('p.cat_narrative_beneficiary_types:', !!p.cat_narrative_beneficiary_types);
    console.log('--- End ---');
}
v()
    .catch(console.error)
    .finally(() => p.$disconnect());
//# sourceMappingURL=final_diagnosis.js.map