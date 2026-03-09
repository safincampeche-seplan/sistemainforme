import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCatalogs() {
    const slugs = [
        { name: 'missions', model: prisma.mission, rels: ['miss_obj_stra_act_narrative'] },
        { name: 'dependencies', model: prisma.dependency, rels: ['users', 'captures'] },
        { name: 'budget-programs', model: prisma.budgetProgram, rels: ['captures'] }
    ];

    for (const s of slugs) {
        try {
            const include = s.rels.length > 0 ? { _count: { select: s.rels.reduce((ac:any, r) => ({...ac, [r]: true}), {}) } } : undefined;
            const res = await (s.model as any).findMany({ include, take: 1 });
            console.log(`✅ ${s.name} OK`);
        } catch(e: any) {
            console.error(`❌ ${s.name} ERROR: ${e.message.split('\n')[0]}`);
        }
    }
}
checkCatalogs().finally(() => prisma.$disconnect());
