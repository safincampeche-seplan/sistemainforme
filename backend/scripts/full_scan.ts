import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Full Period & Mission Scan ---');

    const periods = await (p as any).cat_narrative_periods.findMany();
    console.log('Periods in DB:', JSON.stringify(periods, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    for (const period of periods) {
        const missionsCount = await (p as any).mission.count({ where: { narrative_period_id: period.id } });
        console.log(`Period ID ${period.id} (${period.year}) - Missions: ${missionsCount}`);
    }

    const allMissions = await (p as any).mission.findMany({ take: 5 });
    console.log('Sample Missions Raw:', JSON.stringify(allMissions, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    console.log('--- End of Scan ---');
}
v()
    .catch(console.error)
    .finally(() => p.$disconnect());
