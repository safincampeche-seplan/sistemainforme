const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// BigInt serialization fix for JSON.stringify
BigInt.prototype.toJSON = function () {
    return this.toString();
};

async function testFormatTypes() {
    const COUNT_RELATIONS = {
        'format-types': ['entities'],
        'locations': ['municipality_locality_narrative']
    };

    try {
        const slug = 'format-types';
        const model = prisma.cat_format_types;
        
        const items = await model.findMany({
            skip: 0,
            take: 10,
            orderBy: { id: 'asc' },
            include: COUNT_RELATIONS[slug] && COUNT_RELATIONS[slug].length > 0
                ? { _count: { select: COUNT_RELATIONS[slug].reduce((acc, rel) => { acc[rel] = true; return acc; }, {}) } }
                : undefined
        });

        // Transform records to generic CatalogItem format
        const formattedItems = items.map((item) => {
            let usageCount = 0;
            if (item._count) {
                usageCount = Object.values(item._count).reduce((sum, val) => sum + val, 0);
            }
            return {
                ...item,
                id: item.id.toString(),  // BigInt
                name: item.name || item.title || `Item #${item.id}`,
                usageCount
            };
        });

        console.log("Format Types JSON Payload:");
        console.log(JSON.stringify(formattedItems, null, 2));
    } catch (error) {
        console.error("Format Types Error:", error);
    }

    try {
        const slug = 'locations';
        const model = prisma.cat_localities;
        
        const items2 = await model.findMany({
            skip: 0,
            take: 2,
            orderBy: { id: 'asc' },
            include: COUNT_RELATIONS[slug] && COUNT_RELATIONS[slug].length > 0
                ? { _count: { select: COUNT_RELATIONS[slug].reduce((acc, rel) => { acc[rel] = true; return acc; }, {}) } }
                : undefined
        });

        const formattedItems2 = items2.map((item) => {
            let usageCount = 0;
            if (item._count) {
                usageCount = Object.values(item._count).reduce((sum, val) => sum + val, 0);
            }
            return {
                ...item,
                id: item.id.toString(),  // BigInt
                name: item.name || item.title || `Item #${item.id}`,
                usageCount
            };
        });

        console.log("Locations JSON Payload:");
        console.log(JSON.stringify(formattedItems2, null, 2));
    } catch (error) {
        console.error("Locations Error:", error);
    }
}

testFormatTypes().finally(() => prisma.$disconnect());
