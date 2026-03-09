import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Database Diagnostics ---');
    const periods = await p.cat_narrative_periods.findMany();
    console.log('Periodos:', JSON.stringify(periods, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    const p2026 = periods.find((p) => p.year === '2026');
    if (p2026) {
        const themes = await p.narrativeTheme.findMany({
            where: { title: { cat_missions: { narrative_period_id: p2026.id } } },
            take: 5
        });
        console.log('Sample Themes for 2026:', themes.length);
    }
    const fin = await p.cat_narrative_financing_sources.count();
    console.log('Financing Sources count:', fin);
    const ben = await p.cat_narrative_beneficiary_types.count();
    console.log('Beneficiary Types count:', ben);
    console.log('--- End of Diagnostics ---');
}
v()
    .catch(console.error)
    .finally(() => p.$disconnect());
//# sourceMappingURL=diagnose_catalogs.js.map