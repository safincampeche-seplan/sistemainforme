import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function v() {
    console.log('--- Verification Summary ---');
    console.log('Misiones:', await p.mission.count());
    console.log('Titulos:', await p.narrativeTitle.count());
    console.log('Temas:', await p.narrativeTheme.count());
    console.log('Subtemas:', await p.cat_narrative_sub_themes.count());
    console.log('Programas:', await p.budgetProgram.count());
    console.log('Beneficiarios:', await p.cat_narrative_beneficiary_types.count());
    console.log('Fuentes:', await p.cat_narrative_financing_sources.count());
    console.log('--- End of Verification ---');
}
v()
    .catch(console.error)
    .finally(() => p.$disconnect());
//# sourceMappingURL=verify.js.map