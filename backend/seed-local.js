import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function seed() {
    console.log("🌱 Sembrando base de datos local...");
    // 1. Roles
    const superAdminRole = await prisma.role.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "SuperAdministrador", guard_name: "web" }
    });
    const adminRole = await prisma.role.upsert({
        where: { id: 2 },
        update: {},
        create: { id: 2, name: "Administrador", guard_name: "web" }
    });
    const capturistaRole = await prisma.role.upsert({
        where: { id: 3 },
        update: {},
        create: { id: 3, name: "Capturista", guard_name: "web" }
    });
    const validadorRole = await prisma.role.upsert({
        where: { id: 4 },
        update: {},
        create: { id: 4, name: "Validador", guard_name: "web" }
    });
    const secontRole = await prisma.role.upsert({
        where: { id: 5 },
        update: {},
        create: { id: 5, name: "SECONT", guard_name: "web" }
    });
    // 2. Dependencia
    const dep = await prisma.dependency.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "Secretaría de Planeación", acronym: "SEPLAN" }
    });
    // 3. Narrative Period (required for missions)
    const period = await prisma.cat_narrative_periods.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "2026" }
    });
    // 4. Misión
    const mission = await prisma.mission.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "Gobierno Honesto y Transparente", code: 1, narrative_period_id: period.id }
    });
    // 5. Usuarios adicionales
    const commonPassword = await bcrypt.hash('seplan123', 10);
    const usersData = [
        { name: 'Super Admin', email: 'admin@seplan.gob.mx', roleId: 1 },
        { name: 'Capturista Demo', email: 'saluddemo@seplan.gob.mx', roleId: 3 },
        { name: 'Validador Demo', email: 'validadordemo@seplan.gob.mx', roleId: 4 },
        { name: 'SECONT Demo', email: 'secontdemo@seplan.gob.mx', roleId: 5 },
    ];
    for (const userData of usersData) {
        const newUser = await prisma.user.upsert({
            where: { email: userData.email },
            update: {},
            create: {
                name: userData.name,
                email: userData.email,
                password: commonPassword,
                dependency_id: dep.id,
                is_active: true
            }
        });
        await prisma.userHasRole.upsert({
            where: {
                role_id_model_id_model_type: {
                    role_id: userData.roleId,
                    model_id: newUser.id,
                    model_type: 'App\\Models\\User'
                }
            },
            update: {},
            create: {
                role_id: userData.roleId,
                model_id: newUser.id,
                model_type: 'App\\Models\\User'
            }
        });
    }
    console.log("✅ Base de datos sembrada con éxito.");
    console.log("🔑 Contraseña para todos los nuevos: seplan123");
    console.log("👤 Usuarios añadidos: admin@seplan.gob.mx, saluddemo@seplan.gob.mx, validadordemo@seplan.gob.mx");
}
seed()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-local.js.map