import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Deep Diagnostics ---');
    const p2026 = await (p as any).cat_narrative_periods.findFirst({ where: { year: '2026', deleted_at: null } });
    console.log('Period 2026:', JSON.stringify(p2026, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    if (!p2026) return;

    const missions = await (p as any).mission.findMany({ where: { narrative_period_id: p2026.id } });
    console.log('Missions count:', missions.length);
    if (missions.length > 0) {
        const missionIds = missions.map((m: any) => m.id);
        const titles = await (p as any).narrativeTitle.findMany({ where: { mission_id: { in: missionIds } } });
        console.log('Titles count:', titles.length);

        if (titles.length > 0) {
            const titleIds = titles.map((t: any) => t.id);
            const themes = await (p as any).narrativeTheme.findMany({ where: { narrative_title_id: { in: titleIds } } });
            console.log('Themes count:', themes.length);

            if (themes.length > 0) {
                const themeIds = themes.map((th: any) => th.id);
                const subthemes = await (p as any).cat_narrative_sub_themes.findMany({ where: { narrative_theme_id: { in: themeIds } } });
                console.log('Subthemes count:', subthemes.length);
            }
        }
    }

    const fin = await (p as any).cat_narrative_financing_sources.findMany({ take: 5 });
    console.log('Sample Financing Sources:', fin.length);

    const ben = await (p as any).cat_narrative_beneficiary_types.findMany({ take: 5 });
    console.log('Sample Beneficiary Types:', ben.length);

    console.log('--- End of Deep Diagnostics ---');
}
v()
    .catch(console.error)
    .finally(() => p.$disconnect());
