const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const profiles = await prisma.cat_profiles.findMany();
    console.log("CAT_PROFILES:");
    profiles.forEach(p => console.log(`${p.id}: ${p.name}`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
