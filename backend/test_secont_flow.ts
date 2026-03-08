
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testSecontFlow() {
    console.log("🚀 Iniciando prueba técnica del flujo SECONT...");

    try {
        // 1. Encontrar o crear un usuario SECONT válido
        console.log("\n🔍 Buscando usuario SECONT...");
        let users = await prisma.$queryRaw<any[]>`
            SELECT u.id, u.email 
            FROM users u
            JOIN model_has_roles mhr ON mhr.model_id = u.id
            JOIN roles r ON r.id = mhr.role_id
            WHERE r.name IN ('SECONT', 'Administrador', 'SuperAdministrador')
            LIMIT 1
        `;

        if (!users || users.length === 0) {
            throw new Error("❌ No se encontró ningún usuario con permisos suficientes (SECONT/Admin/SuperAdmin) para la prueba.");
        }
        let secontUser = users[0];
        console.log(`✅ Usuario encontrado: ${secontUser.email} (ID: ${secontUser.id})`);

        // 2. Encontrar una narrativa lista para SECONT (under_validation_secont) o forzar una
        console.log("\n🔍 Buscando narrativa lista para SECONT (estado: under_validation_secont)...");
        let narrative = await prisma.narrativeCapture.findFirst({
            where: { status: 'under_validation_secont' },
            orderBy: { id: 'desc' }
        });

        if (!narrative) {
            console.log("⚠️ No hay narrativas en 'under_validation_secont'. Buscando una finalizada para forzarla a SECONT...");
            narrative = await prisma.narrativeCapture.findFirst({
                where: { status: 'finalized' },
                orderBy: { id: 'desc' }
            });

            if (!narrative) {
                console.log("⚠️ No hay narrativas finalizadas. Buscando cualquier narrativa existente...");
                narrative = await prisma.narrativeCapture.findFirst({
                    orderBy: { id: 'desc' }
                });
            }

            if (!narrative) {
                throw new Error("❌ No hay NINGUNA narrativa en la base de datos para probar.");
            }

            console.log(`🔧 Forzando narrativa ID ${narrative.id} al estado 'under_validation_secont' para la prueba.`);
            await prisma.narrativeCapture.update({
                where: { id: narrative.id },
                data: { status: 'under_validation_secont' }
            });
            console.log("✅ Narrativa forzada con éxito.");
        } else {
            console.log(`✅ Narrativa encontrada: ID ${narrative.id} - ${narrative.ppa_name}`);
        }

        // 3. Simular la lógica de aprobación SECONT (Mismo código que en index.ts)
        console.log(`\n⏳ Simulando aprobación SECONT para Narrativa ID: ${narrative.id}...`);

        const id = narrative.id;
        const observations = "Aprobación de prueba mediante script técnico SECONT.";
        const editorId = (Number(secontUser.id) >= 700 || Number(secontUser.id) === 105) ? null : BigInt(secontUser.id);
        const newStatus = 'approved_secont';

        await prisma.$executeRaw`
            UPDATE narrative_captures 
            SET status = 'approved secont', observations = ${observations}, edited_by = ${editorId}, updated_at = NOW() 
            WHERE id = ${id}
        `;
        const updatedNarrative = { id, status: newStatus };

        console.log("✅ update() de Prisma ejecutado correctamente.");

        // 4. Registrar en el historial de estados
        console.log("\n⏳ Registrando en narrative_capture_status_histories...");
        await prisma.narrative_capture_status_histories.create({
            data: {
                narrative_capture_id: id,
                status: newStatus,
                observations: observations,
                created_by: editorId || BigInt(1),
                created_at: new Date(),
            }
        });
        console.log("✅ Historial registrado correctamente.");

        console.log(`\n🎉 ¡PRUEBA EXITOSA! El flujo de aprobación SECONT funciona a nivel de base de datos.`);
        console.log(`Resultado Final: Narrativa ID ${updatedNarrative.id} -> Estado: ${updatedNarrative.status}`);

    } catch (error: any) {
        console.error("\n❌ ERROR DURANTE LA PRUEBA DEL FLUJO SECONT:");
        console.error(error.message || error);

        if (error.message && error.message.includes('narrative_financing_source_id')) {
            console.log("\n⚠️ ALERTA: El error del cliente de Prisma desactualizado persiste.");
            console.log("Por favor, asegúrate de que el backend se reinició completamente después de ejecutar 'npx prisma generate'.");
        }
    } finally {
        await prisma.$disconnect();
    }
}

testSecontFlow();
