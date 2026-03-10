const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🔍 DIAGNÓSTICO PROFUNDO DE ACCESO Y DATOS...");

    // 1. Verificar Admin
    const admin = await prisma.user.findFirst({
        where: { email: { contains: 'admin@admin' } },
        include: { cat_profiles: true, dependency: true }
    });

    if (admin) {
        console.log("✅ Admin encontrado!");
        console.log(`- Email: ${admin.email}`);
        console.log(`- Perfil: ${admin.cat_profiles?.name || '❌ SIN PERFIL'} (ID: ${admin.profile_id})`);
        console.log(`- Dependencia: ${admin.dependency?.name || '❌ SIN DEPENDENCIA'} (ID: ${admin.dependency_id})`);
    } else {
        console.log("❌ ADMIN NO ENCONTRADO.");
    }

    // 2. Verificar Catálogos Críticos
    const profiles = await prisma.cat_profiles.count();
    const dependencies = await prisma.dependency.count();
    const titles = await prisma.narrativeTitle.count();
    const themes = await prisma.narrativeTheme.count();
    const periods = await prisma.cat_narrative_periods.count();

    console.log("\n📊 Conteo de Catálogos:");
    console.log(`- Perfiles (cat_profiles): ${profiles}`);
    console.log(`- Dependencias (dependency): ${dependencies}`);
    console.log(`- Periodos (cat_narrative_periods): ${periods}`);
    console.log(`- Títulos (cat_narrative_titles/NarrativeTitle): ${titles}`);
    console.log(`- Temas (cat_narrative_themes/NarrativeTheme): ${themes}`);

    if (profiles === 0) console.log("⚠️ CRITICAL: La tabla cat_profiles está VACÍA.");
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
