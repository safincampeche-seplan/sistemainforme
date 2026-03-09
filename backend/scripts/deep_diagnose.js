import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Deep Diagnostics ---');
    const p2026 = await p.cat_narrative_periods.findFirst({ where: { year: '2026', deleted_at: null } });
    console.log('Period 2026:', JSON.stringify(p2026, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    if (!p2026)
        return;
    const missions = await p.mission.findMany({ where: { narrative_period_id: p2026.id } });
    console.log('Missions count:', missions.length);
    if (missions.length > 0) {
        const missionIds = missions.map((m) => m.id);
        const titles = await p.narrativeTitle.findMany({ where: { mission_id: { in: missionIds } } });
        console.log('Titles count:', titles.length);
        if (titles.length > 0) {
            const titleIds = titles.map((t) => t.id);
            const themes = await p.narrativeTheme.findMany({ where: { narrative_title_id: { in: titleIds } } });
            console.log('Themes count:', themes.length);
            if (themes.length > 0) {
                const themeIds = themes.map((th) => th.id);
                const subthemes = await p.cat_narrative_sub_themes.findMany({ where: { narrative_theme_id: { in: themeIds } } });
                console.log('Subthemes count:', subthemes.length);
            }
        }
    }
    const fin = await p.cat_narrative_financing_sources.findMany({ take: 5 });
    console.log('Sample Financing Sources:', fin.length);
    const ben = await p.cat_narrative_beneficiary_types.findMany({ take: 5 });
    console.log('Sample Beneficiary Types:', ben.length);
    console.log('--- End of Deep Diagnostics ---');
}
v()
    .catch(console.error)
    .finally(() => p.$disconnect());
//# sourceMappingURL=deep_diagnose.js.map