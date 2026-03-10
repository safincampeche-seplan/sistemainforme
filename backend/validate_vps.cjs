const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("📊 VALIDANDO ESTADO DE TABLAS EN EL VPS...");

    const stats = await Promise.all([
        prisma.cat_municipalities.count(),
        prisma.cat_localities.count(),
        prisma.cat_sectors.count(),
        prisma.dependency.count(),
        prisma.cat_profiles.count(),
        prisma.user.count()
    ]);

    console.log(`- Municipios: ${stats[0]}`);
    console.log(`- Localidades: ${stats[1]}`);
    console.log(`- Sectores: ${stats[2]}`);
    console.log(`- Dependencias: ${stats[3]}`);
    console.log(`- Perfiles: ${stats[4]}`);
    console.log(`- Usuarios: ${stats[5]}`);

    if (stats[3] === 0) {
        console.log("❌ ERROR: La tabla de Dependencias está VACÍA.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
