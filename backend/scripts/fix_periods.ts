import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Fixing Period Consistency ---');

    // 1. Undelete Period 1 (The one with existing missions)
    await (p as any).cat_narrative_periods.update({
        where: { id: BigInt(1) },
        data: { deleted_at: null }
    });
    console.log('Undeleted Period 1');

    // 2. Remove Period 5 (The redundant one I created)
    try {
        await (p as any).cat_narrative_periods.delete({
            where: { id: BigInt(5) }
        });
        console.log('Deleted redundant Period 5');
    } catch (e) {
        console.log('Period 5 already deleted or not found');
    }

    console.log('--- Done ---');
}
v()
    .catch(console.error)
    .finally(() => p.$disconnect());
