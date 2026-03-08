import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const n = await prisma.narrativeCapture.findFirst({
        where: { sequence_number: 'TEST-2026-FINAL' },
        include: {
            cat_ppas_types: true,
            cat_narrative_periods: true
        }
    });
    
    // Custom replacer para imprimir BigInt
    console.log(JSON.stringify(n, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    await prisma.$disconnect();
}
run();
