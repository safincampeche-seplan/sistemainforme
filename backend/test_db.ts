import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        const captures = await prisma.narrativeCapture.findMany({
            where: { dependency_id: 15 }
        });
        console.log(`Encontradas ${captures.length} narrativas para dependency 15:`);
        console.log(captures.map(c => ({ id: c.id, ppa: c.ppa_name })));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
check();
