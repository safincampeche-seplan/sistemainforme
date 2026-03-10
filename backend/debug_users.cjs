const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🔍 REVISANDO ESTADO DE USUARIOS Y PERFILES...");

    const users = await prisma.user.findMany({
        take: 10,
        include: { cat_profiles: true }
    });

    console.log(`\n--- Mostrando primeros ${users.length} usuarios ---`);
    users.forEach(u => {
        console.log(`ID: ${u.id} | Email: ${u.email} | Nombre: ${u.name} | Perfil: ${u.cat_profiles?.name || 'SIN PERFIL'} (ID: ${u.profile_id})`);
    });

    const profiles = await prisma.cat_profiles.findMany();
    console.log("\n--- Perfiles Disponibles ---");
    profiles.forEach(p => {
        console.log(`ID: ${p.id} | Nombre: ${p.name}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
