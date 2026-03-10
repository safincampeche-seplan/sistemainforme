const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const admin = await prisma.user.findUnique({
        where: { email: 'admin@admin' }
    });

    if (admin) {
        console.log("✅ Admin found!");
        console.log(`ID: ${admin.id}`);
        console.log(`Name: ${admin.name}`);
        console.log(`Email: ${admin.email}`);
        console.log(`Profile ID: ${admin.profile_id}`);
    } else {
        console.log("❌ Admin NOT found in database.");
        const count = await prisma.user.count();
        console.log(`Total users in DB: ${count}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
