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

    // 2. Dependencia
    const dep = await prisma.dependency.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "Secretaría de Planeación", acronym: "SEPLAN", periodo: 2026 }
    });

    // 3. Misión
    const mission = await prisma.mission.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "Gobierno Honesto y Transparente", code: "M1", periodo: 2026 }
    });

    // 4. Usuarios adicionales
    const commonPassword = await bcrypt.hash('seplan123', 10);

    const usersData = [
        { name: 'Super Admin', email: 'superadmin@seplan.com', roleId: 1 },
        { name: 'SECONT User', email: 'secont@seplan.com', roleId: 2 },
        { name: 'Cajero User', email: 'cajero@seplan.com', roleId: 3 },
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
    console.log("👤 Usuarios añadidos: superadmin@seplan.com, secont@seplan.com, cajero@seplan.com");
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
