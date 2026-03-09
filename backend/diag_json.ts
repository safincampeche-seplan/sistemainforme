import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// BigInt serialization fix for JSON.stringify
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

async function testFormatTypes() {
    const COUNT_RELATIONS: any = {
        'format-types': ['entities'],
        'locations': ['municipality_locality_narrative']
    };

    try {
        const slug = 'format-types';
        const model = prisma.cat_format_types;

        const items = await model.findMany({
            skip: 0,
            take: 2,
            orderBy: { id: 'asc' },
            include: COUNT_RELATIONS[slug] && COUNT_RELATIONS[slug].length > 0
                ? { _count: { select: COUNT_RELATIONS[slug].reduce((acc: any, rel: any) => { acc[rel] = true; return acc; }, {}) } }
                : undefined
        });

        const formattedItems = items.map((item: any) => {
            let usageCount = 0;
            if (item._count) {
                usageCount = Object.values(item._count).reduce((sum: any, val: any) => sum + val, 0);
            }
            return {
                ...item,
                id: item.id.toString(),  // BigInt
                name: item.name || item.title || `Item #${item.id}`,
                usageCount
            };
        });

        console.log('Format Types JSON Payload:', JSON.stringify(formattedItems, null, 2));
    } catch (error) {
        console.error('Format Types Error:', error);
    }

    try {
        const slug = 'locations';
        const model = prisma.cat_localities;

        const items = await model.findMany({
            skip: 0,
            take: 2,
            orderBy: { id: 'asc' },
            include: COUNT_RELATIONS[slug] && COUNT_RELATIONS[slug].length > 0
                ? { _count: { select: COUNT_RELATIONS[slug].reduce((acc: any, rel: any) => { acc[rel] = true; return acc; }, {}) } }
                : undefined
        });

        const formattedItems = items.map((item: any) => {
            let usageCount = 0;
            if (item._count) {
                usageCount = Object.values(item._count).reduce((sum: any, val: any) => sum + val, 0);
            }
            return {
                ...item,
                id: item.id.toString(),  // BigInt
                name: item.name || item.title || `Item #${item.id}`,
                usageCount
            };
        });

        console.log('Locations JSON Payload:', JSON.stringify(formattedItems, null, 2));
    } catch (error) {
        console.error('Locations Error:', error);
    }
}
testFormatTypes().finally(() => prisma.$disconnect());
