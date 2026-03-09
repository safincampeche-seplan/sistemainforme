import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCatalogs() {
    const CATALOG_MODELS: Record<string, any> = {
        'narrative-titles': prisma.narrativeTitle,
        'narrative-themes': prisma.narrativeTheme,
        'narrative-subthemes': prisma.cat_narrative_sub_themes,
        'financing-sources': prisma.cat_narrative_financing_sources,
        'ods': prisma.odsLinkage,
        'missions': prisma.mission,
        'axis': prisma.mission,
        'dependencies': prisma.dependency,
        'beneficiary-types': prisma.cat_narrative_beneficiary_types,
        'budget-programs': prisma.budgetProgram,
        'sectors': prisma.cat_sectors,
        'ppas-types': prisma.cat_ppas_types,
        'locations': prisma.cat_localities,
        'periods': prisma.cat_narrative_periods,
        'format-types': prisma.cat_format_types
    };

    const COUNT_RELATIONS: Record<string, string[]> = {
        'narrative-titles': ['narrative_captures'],
        'narrative-themes': ['narrative_captures'],
        'narrative-subthemes': ['narrative_captures'],
        'financing-sources': ['narrative_financing_sources'],
        'missions': ['miss_obj_stra_act_narrative'],
        'axis': ['miss_obj_stra_act_narrative'],
        'dependencies': ['users', 'captures'],
        'beneficiary-types': ['narrative_captures'],
        'budget-programs': ['captures'],
        'sectors': ['cat_dependencies'],
        'ppas-types': ['narrative_captures'],
        'locations': ['municipality_locality_narrative'],
        'periods': ['narrative_captures'],
    };

    for (const slug of Object.keys(CATALOG_MODELS)) {
        const model = CATALOG_MODELS[slug];
        if (!model) { console.error(`❌ NO MODEL FOR ${slug}`); continue; }

        const relations = COUNT_RELATIONS[slug] || [];
        try {
            const include = relations.length > 0 
                ? { _count: { select: relations.reduce((acc: any, rel) => { acc[rel] = true; return acc; }, {}) } }
                : undefined;
            const res = await model.findMany({ include, take: 1 });
            console.log(`✅ ${slug} QUERY OK - Found: ${res.length}`);
        } catch(e: any) {
            console.error(`❌ ${slug} ERROR: ${e.message.split('\n').join(' ').substring(0, 100)}`);
        }
    }
}
checkCatalogs().finally(() => prisma.$disconnect());
