
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const n = await prisma.narrativeCapture.findUnique({
        where: { id: 2480n }
    });

    console.log(JSON.stringify(n, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
        , 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
