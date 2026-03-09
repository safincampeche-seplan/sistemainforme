import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const prisma = new PrismaClient();
async function main() {
    const indiceData = JSON.parse(fs.readFileSync('/tmp/indice_data.json', 'utf8'));
    const ppaData = JSON.parse(fs.readFileSync('/tmp/ppa_data.json', 'utf8'));
    console.log('--- Starting 2026 Catalog Import ---');
    // 1. Ensure 2026 period exists
    let period = await prisma.cat_narrative_periods.findFirst({
        where: { year: '2026' }
    });
    if (!period) {
        period = await prisma.cat_narrative_periods.create({
            data: {
                year: '2026',
                name: '5to Informe de Gobierno'
            }
        });
        console.log('Created period 2026');
    }
    const periodId = period.id;
    // Mappings to handle hierarchy (Excel Relative IDs to Database BigInt IDs)
    const missionMap = new Map();
    const titleMap = new Map(); // key: mission_id-title_id
    const themeMap = new Map(); // key: title_id-theme_id
    const subthemeMap = new Map(); // key: theme_id-subtheme_id
    // 2. Import Missions, Titles, Themes, Subthemes
    for (const item of indiceData) {
        // Mission
        if (!missionMap.has(item.id_mision)) {
            let m = await prisma.mission.findFirst({
                where: { name: item.descripcion_mision, narrative_period_id: periodId }
            });
            if (!m) {
                m = await prisma.mission.create({
                    data: {
                        name: item.descripcion_mision,
                        code: parseInt(item.id_mision),
                        narrative_period_id: periodId
                    }
                });
            }
            missionMap.set(item.id_mision, m);
        }
        const mission = missionMap.get(item.id_mision);
        // Title
        const titleKey = `${item.id_mision}-${item.id_titulo}`;
        if (!titleMap.has(titleKey)) {
            let t = await prisma.narrativeTitle.findFirst({
                where: { name: item.descripcion_titulo, mission_id: mission.id }
            });
            if (!t) {
                t = await prisma.narrativeTitle.create({
                    data: {
                        name: item.descripcion_titulo,
                        mission_id: mission.id,
                        code: parseInt(item.id_titulo)
                    }
                });
            }
            titleMap.set(titleKey, t);
        }
        const title = titleMap.get(titleKey);
        // Theme
        const themeKey = `${title.id}-${item.id_tema}`;
        if (!themeMap.has(themeKey)) {
            let th = await prisma.narrativeTheme.findFirst({
                where: { name: item.descripcion_tema, narrative_title_id: title.id }
            });
            if (!th) {
                th = await prisma.narrativeTheme.create({
                    data: {
                        name: item.descripcion_tema,
                        narrative_title_id: title.id,
                        code: parseInt(item.id_tema)
                    }
                });
            }
            themeMap.set(themeKey, th);
        }
        const theme = themeMap.get(themeKey);
        // Subtheme
        const subthemeKey = `${theme.id}-${item.id_subtema}`;
        if (!subthemeMap.has(subthemeKey)) {
            let st = await prisma.cat_narrative_sub_themes.findFirst({
                where: { name: item.descripcion_subtema, narrative_theme_id: theme.id }
            });
            if (!st) {
                st = await prisma.cat_narrative_sub_themes.create({
                    data: {
                        name: item.descripcion_subtema,
                        narrative_theme_id: theme.id,
                        code: parseInt(item.id_subtema)
                    }
                });
            }
            subthemeMap.set(subthemeKey, st);
        }
    }
    console.log('Hierarchies (Missions/Titles/Themes/Subthemes) imported.');
    // 3. Import Budget Programs (PPAs)
    // BudgetProgram is not linked via DB relations to themes, but it has a code and name.
    for (const ppa of ppaData) {
        if (!ppa.nombre_ppa)
            continue;
        // Use id from Excel as the code if possible, or some other numeric value
        const ppaCode = parseInt(ppa.id) || 0;
        let p = await prisma.budgetProgram.findFirst({
            where: { name: ppa.nombre_ppa, code: ppaCode }
        });
        if (!p) {
            await prisma.budgetProgram.create({
                data: {
                    name: ppa.nombre_ppa,
                    code: ppaCode,
                    type: ppa.siglas || 'PPA'
                }
            });
        }
    }
    console.log('Budget Programs (PPAs) imported.');
    // 4. Import default Beneficiary Types
    const beneficiaries = ['Personas', 'Familias', 'Localidades', 'Municipios', 'Escuelas', 'Productores', 'Mujeres', 'Niños/as'];
    for (const name of beneficiaries) {
        const exists = await prisma.cat_narrative_beneficiary_types.findFirst({ where: { name } });
        if (!exists) {
            await prisma.cat_narrative_beneficiary_types.create({ data: { name } });
        }
    }
    // 5. Import default Financing Sources
    const sources = ['Estatal', 'Federal', 'Convenios', 'Recursos Propios', 'FISM', 'FORTAMUN'];
    for (const name of sources) {
        const exists = await prisma.cat_narrative_financing_sources.findFirst({ where: { name } });
        if (!exists) {
            await prisma.cat_narrative_financing_sources.create({ data: { name } });
        }
    }
    console.log('Support catalogs (Beneficiaries/Financing) imported.');
    console.log('--- 2026 Catalog Import Completed Successfully ---');
}
main()
    .catch((e) => {
    console.error('Import Error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import_2026_catalogs.js.map