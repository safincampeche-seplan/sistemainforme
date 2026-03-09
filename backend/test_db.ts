import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const period = await prisma.cat_narrative_periods.findFirst({ where: { year: '2026' } });
    console.log("Period 2026:", period);
    
    const missions = await prisma.mission.findMany();
    console.log("Missions:", missions.length);
    if(missions.length > 0) console.log("First Mission id:", missions[0].id, "period_id:", missions[0].narrative_period_id);
    
    const titles = await prisma.narrativeTitle.findMany();
    console.log("Titles:", titles.length);
    if(titles.length > 0) console.log("First Title id:", titles[0].id, "mission_id:", titles[0].mission_id);
    
    const themes = await prisma.narrativeTheme.findMany();
    console.log("Themes:", themes.length);
    if(themes.length > 0) console.log("First Theme id:", themes[0].id, "title_id:", themes[0].narrative_title_id);
}
main().finally(() => prisma.$disconnect());
