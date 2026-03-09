import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
    try {
        console.log("Intentando insertar en MySQL...");
        const narrative = await prisma.narrativeCapture.create({
            data: {
                ppa_name: "FLUJO E2E SALUD DEMO TEST PPA",
                investment_amount: "500000",
                beneficiaries: 150,
                narrative_breakdown: "Esta es una narrativa de prueba E2E automatizada.",
                highlighted: "Destacado E2E",
                periodo: 2026,
                status: "En Validación",
                dependency_id: 15,
                mission_id: 1,
                narrative_title_id: 1,
                narrative_theme_id: 1,
                narrative_sub_theme_id: 1,
                financing_source_id: null,
                beneficiary_type_id: null,
                budget_program_id: null,
                locations: [],
                peds: []
            }
        });
        console.log("Éxito! ID:", narrative.id);
    }
    catch (e) {
        console.error("Error de Prisma SQL:");
        console.error(e);
    }
    finally {
        await prisma.$disconnect();
    }
}
check();
//# sourceMappingURL=test_db_insert.js.map