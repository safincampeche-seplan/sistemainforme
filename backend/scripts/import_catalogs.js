import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import path from 'path';
const prisma = new PrismaClient();
async function main() {
    const rootDir = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme';
    const indicePath = path.join(rootDir, 'input_indice (1).xlsx');
    const programPath = path.join(rootDir, 'catalogo_programas_presupuestarios_2024 (1).xlsx');
    console.log('--- Importando Estructura PED (Índice) ---');
    const workbookIndice = xlsx.readFile(indicePath);
    const sheetIndice = workbookIndice.Sheets[workbookIndice.SheetNames[0]];
    const dataIndice = xlsx.utils.sheet_to_json(sheetIndice);
    // Asegurar periodo 2026
    const period = await prisma.cat_narrative_periods.upsert({
        where: { id: BigInt(1) }, // Asumimos ID 1 para 2026 o buscamos por nombre
        update: { name: '5to Informe de Gobierno', year: '2026' },
        create: { id: BigInt(1), name: '5to Informe de Gobierno', year: '2026' }
    });
    for (const row of dataIndice) {
        const { id_mision, descripcion_mision, id_titulo, descripcion_titulo, id_tema, descripcion_tema, id_subtema, descripcion_subtema } = row;
        if (!id_mision)
            continue;
        // 1. Misión (Eje)
        const mission = await prisma.mission.upsert({
            where: { id: BigInt(id_mision) },
            update: { name: descripcion_mision, code: id_mision, narrative_period_id: period.id },
            create: { id: BigInt(id_mision), name: descripcion_mision, code: id_mision, narrative_period_id: period.id }
        });
        // 2. Título
        const title = await prisma.narrativeTitle.upsert({
            where: { id: BigInt(id_titulo) },
            update: { name: descripcion_titulo, code: id_titulo, mission_id: mission.id },
            create: { id: BigInt(id_titulo), name: descripcion_titulo, code: id_titulo, mission_id: mission.id }
        });
        // 3. Tema
        const theme = await prisma.narrativeTheme.upsert({
            where: { id: BigInt(id_tema) },
            update: { name: descripcion_tema, code: id_tema, narrative_title_id: title.id },
            create: { id: BigInt(id_tema), name: descripcion_tema, code: id_tema, narrative_title_id: title.id }
        });
        // 4. Subtema
        if (id_subtema && descripcion_subtema) {
            await prisma.cat_narrative_sub_themes.upsert({
                where: { id: BigInt(id_subtema) },
                update: { name: descripcion_subtema, code: id_subtema, narrative_theme_id: theme.id },
                create: { id: BigInt(id_subtema), name: descripcion_subtema, code: id_subtema, narrative_theme_id: theme.id }
            });
        }
    }
    console.log('--- Importando Catálogo de Programas Presupuestarios ---');
    const workbookProg = xlsx.readFile(programPath);
    const sheetProg = workbookProg.Sheets[workbookProg.SheetNames[0]];
    // Saltamos las primeras 3 filas que son cabeceras estéticas
    const dataProg = xlsx.utils.sheet_to_json(sheetProg, { range: 3, header: ['code', 'name'] });
    for (const row of dataProg) {
        if (!row.code || !row.name)
            continue;
        // El excel tiene códigos como '001', '002'. Prisma espera Int.
        const codeInt = parseInt(row.code);
        if (isNaN(codeInt))
            continue;
        await prisma.budgetProgram.upsert({
            where: { id: BigInt(codeInt) },
            update: { name: row.name, code: codeInt, type: 'Estatal' },
            create: { id: BigInt(codeInt), name: row.name, code: codeInt, type: 'Estatal' }
        });
    }
    console.log('Importación de catálogos finalizada.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import_catalogs.js.map