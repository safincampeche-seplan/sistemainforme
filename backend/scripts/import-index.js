import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
const prisma = new PrismaClient();
async function main() {
    const excelPath = path.join(process.cwd(), '..', 'input_indice.xlsx');
    if (!fs.existsSync(excelPath)) {
        console.error('Archivo input_indice.xlsx no encontrado en la raíz del proyecto.');
        process.exit(1);
    }
    console.log('--- Iniciando importación de catálogo de clasificación ---');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
        throw new Error('No se encontró ninguna hoja en el Excel');
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log(`Leídas ${rows.length} filas del Excel.`);
    // 1. Asegurar periodo 2026 (5o Informe)
    const period = await prisma.cat_narrative_periods.upsert({
        where: { id: BigInt(5) },
        update: { name: '5o Informe', year: '2026' },
        create: { id: BigInt(5), name: '5o Informe', year: '2026' }
    });
    console.log(`Periodo configurado: ${period.name} (${period.year})`);
    // Mapa para evitar duplicados y facilitar jerarquía
    const missionsMap = new Map();
    const titlesMap = new Map();
    const themesMap = new Map();
    for (const row of rows) {
        const missionId = parseInt(row['id_mision']);
        const missionName = row['descripcion_mision'];
        const titleId = parseInt(row['id_titulo']);
        const titleName = row['descripcion_titulo'];
        const themeId = parseInt(row['id_tema']);
        const themeName = row['descripcion_tema'];
        const subthemeId = parseInt(row['id_subtema']);
        const subthemeName = row['descripcion_subtema'];
        if (!missionId || isNaN(missionId))
            continue;
        // --- MISIÓN ---
        if (!missionsMap.has(missionId)) {
            const m = await prisma.mission.upsert({
                where: { id: BigInt(missionId) },
                update: { name: missionName, code: missionId, narrative_period_id: period.id },
                create: { id: BigInt(missionId), name: missionName, code: missionId, narrative_period_id: period.id }
            });
            missionsMap.set(missionId, m.id);
            console.log(`Misión [${missionId}]: ${missionName}`);
        }
        const mDbId = missionsMap.get(missionId);
        // --- TÍTULO ---
        if (!titleId || isNaN(titleId))
            continue;
        const titleKey = `${missionId}-${titleId}`;
        if (!titlesMap.has(titleKey)) {
            const t = await prisma.narrativeTitle.upsert({
                where: { id: BigInt(titleId) },
                update: { name: titleName, code: titleId, mission_id: mDbId },
                create: { id: BigInt(titleId), name: titleName, code: titleId, mission_id: mDbId }
            });
            titlesMap.set(titleKey, t.id);
            console.log(`  Título [${titleId}]: ${titleName}`);
        }
        const tDbId = titlesMap.get(titleKey);
        // --- TEMA ---
        if (!themeId || isNaN(themeId))
            continue;
        const themeKey = `${titleKey}-${themeId}`;
        if (!themesMap.has(themeKey)) {
            const th = await prisma.narrativeTheme.upsert({
                where: { id: BigInt(themeId) },
                update: { name: themeName, code: themeId, narrative_title_id: tDbId },
                create: { id: BigInt(themeId), name: themeName, code: themeId, narrative_title_id: tDbId }
            });
            themesMap.set(themeKey, th.id);
            console.log(`    Tema [${themeId}]: ${themeName}`);
        }
        const thDbId = themesMap.get(themeKey);
        // --- SUBTEMA ---
        if (subthemeId && !isNaN(subthemeId) && subthemeName) {
            await prisma.cat_narrative_sub_themes.upsert({
                where: { id: BigInt(subthemeId) },
                update: { name: subthemeName, code: subthemeId, narrative_theme_id: thDbId },
                create: { id: BigInt(subthemeId), name: subthemeName, code: subthemeId, narrative_theme_id: thDbId }
            });
        }
    }
    console.log('--- Importación finalizada con éxito ---');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import-index.js.map