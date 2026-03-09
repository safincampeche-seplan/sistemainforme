import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();
async function main() {
    console.log("🌱 Iniciando Test de Narrativa Completa...\n");
    const title = await prisma.narrativeTitle.findFirst();
    const theme = await prisma.narrativeTheme.findFirst({ where: { narrative_title_id: title.id } });
    const budgetProgram = await prisma.budgetProgram.findFirst();
    // Usuario para la dependencia
    const user = await prisma.user.findFirst({ where: { email: { contains: 'salud' } } })
        || await prisma.user.findFirst();
    const dependency = await prisma.dependency.findUnique({ where: { id: user?.dependency_id } })
        || await prisma.dependency.findFirst();
    if (!title || !theme || !budgetProgram || !dependency) {
        console.error("❌ Faltan catálogos primarios en la BD.");
        process.exit(1);
    }
    console.log(`Usando Dependencia: ${dependency.name}`);
    // Crear la Narrativa Principal
    const narrative = await prisma.narrativeCapture.create({
        data: {
            sequence_number: "TEST-2026-FINAL",
            narrative_period_id: 5, // Asumiendo 2026
            dependency_id: dependency.id,
            created_by: user.id,
            status: "under_validation_semaig", // Estado visible para el admin
            // Clasificación
            narrative_title_id: title.id,
            narrative_theme_id: theme.id,
            // Detalles PPA
            ppa_name: "TEST GLOBAL: Equipamiento y Remodelación de Unidades Médicas",
            ppas_type_id: 1,
            budget_program_id: budgetProgram.id,
            narrative_financing_source_id: 1, // IDs Hardcodeados porque las tablas originales
            investment_amount: 15500000.50, // no tienen Primary Key y Prisma las ignora
            beneficiaries: 125000,
            narrative_beneficiary_type_id: 1,
            // Arrays JSON nativos de Prisma (serializados como String porque el esquema puede pedirlo)
            locations: [
                { municipality_id: "1", localities: "Centro, Samulá" },
                { municipality_id: "3", localities: "Ciudad del Carmen" }
            ],
            peds: [
                { mission_id: "1", objective_id: "1", strategy_id: "1", action_line_id: "1" }
            ],
            // Relaciones Anidadas de Prisma (ODS)
            ods_linkage_narrative: {
                create: [
                    { cat_ods_linkages: { connect: { id: 3 } } },
                    { cat_ods_linkages: { connect: { id: 10 } } }
                ]
            },
            // Narrativa Técnica
            narrative_breakdown: "Se llevó a cabo la remodelación integral de 5 unidades médicas en las jurisdicciones prioritarias. Las acciones incluyeron: impermeabilización, cambio de instalaciones eléctricas, renovación de equipos de diagnóstico (rayos X y ultrasonido), y capacitación de 45 miembros del personal. Con esto se asegura una atención de calidad y se reduce el tiempo de espera en un 30% para los pacientes de comunidades aledañas.",
            highlighted: "Reducción del 30% en tiempos de espera y modernización con equipos de última generación en 5 unidades médicas del estado.",
        }
    });
    console.log(`✅ Narrativa completa creada con ID: ${narrative.id} - TEST FINAL`);
    console.log("\n🎉 TEST COMPLETADO. Ahora puedes iniciar sesión como Admin (admin@seplan.gob.mx) y ver la solicitud en 'Revisión / Validaciones'.");
}
main()
    .catch(e => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed_test_narrative.js.map