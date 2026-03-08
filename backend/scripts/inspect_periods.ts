import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
    // Consultar períodos de narrativas
    const narrativePeriods = await prisma.cat_narrative_periods.findMany({ orderBy: { id: 'asc' } });
    console.log('PERÍODOS NARRATIVOS:');
    narrativePeriods.forEach(p => console.log(`  ID=${p.id}, Nombre=${JSON.stringify(p)}`));

    // Contar narrativas por período
    const narByPeriod = await prisma.narrativeCapture.groupBy({
        by: ['narrative_period_id'],
        _count: { id: true }
    });
    console.log('\nNARRATIVAS POR PERÍODO:');
    narByPeriod.forEach(n => console.log(`  Period ID=${n.narrative_period_id} -> ${n._count.id} narrativas`));

    // Períodos estadísticos
    const statPeriods = await prisma.cat_periods.findMany({ orderBy: { id: 'asc' } });
    console.log('\nPERÍODOS ESTADÍSTICOS:');
    statPeriods.forEach(p => console.log(`  ${JSON.stringify(p)}`));

    // Entradas estadísticas por período
    const entriesByPeriod = await prisma.entry.groupBy({
        by: ['period_id'],
        _count: { id: true }
    });
    console.log('\nENTRADAS ESTADÍSTICAS POR PERÍODO:');
    entriesByPeriod.forEach(e => console.log(`  Period ID=${e.period_id} -> ${e._count.id} entradas`));
}

main().finally(() => prisma.$disconnect());
