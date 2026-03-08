const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreate() {
    try {
        const narrative = await prisma.narrativeCapture.create({
            data: {
                ppa_name: 'PPA de Prueba E2E Automática',
                investment_amount: '1500000',
                beneficiaries: 1500,
                narrative_breakdown: "undefined",
                highlighted: "undefined",
                narrative_period_id: 5,
                status: 'draft',
                dependency_id: 1,
                narrative_title_id: 1,
                narrative_theme_id: null,
                narrative_sub_theme_id: null,
                narrative_financing_source_id: null,
                narrative_beneficiary_type_id: null,
                budget_program_id: null,
                sequence_number: `NARR-${Date.now().toString().slice(-6)}`,
            }
        });
        console.log("Success:", narrative.id.toString());
    } catch (err) {
        console.error("PRISMA ERROR DETAILED:", err);
    }
}
testCreate().then(() => prisma.$disconnect());
