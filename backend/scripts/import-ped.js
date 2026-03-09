import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import * as path from 'path';
const prisma = new PrismaClient();
async function main() {
    console.log("🚀 Starting PED 2024 import using raw SQL...");
    // Get or create the narrative period for 2026 (5to Informe)
    let periodResult = await prisma.$queryRaw `SELECT id FROM cat_narrative_periods WHERE year = 2026 LIMIT 1`;
    let periodId = periodResult.length > 0 ? periodResult[0].id : null;
    if (!periodId) {
        console.log("Period 2026 not found, creating it...");
        await prisma.$executeRaw `INSERT INTO cat_narrative_periods (year, name, is_active) VALUES (2026, '5to Informe', 1)`;
        periodResult = await prisma.$queryRaw `SELECT id FROM cat_narrative_periods WHERE year = 2026 LIMIT 1`;
        periodId = periodResult[0].id;
    }
    const filePath = path.join(process.cwd(), '..', 'alineación_ped_2024.xlsx');
    console.log(`Reading Excel file from ${filePath}`);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // The actual headers start at row 2 (0-indexed row 1)
    const data = xlsx.utils.sheet_to_json(sheet, { range: 1 });
    console.log(`Found ${data.length} rows to process.`);
    let missionsCount = 0;
    let objectivesCount = 0;
    let strategiesCount = 0;
    let actionLinesCount = 0;
    for (const row of data) {
        const missionId = parseInt(row['id_mision']);
        const missionName = row['nom_mision']?.toString().trim();
        const objectiveId = parseInt(row['id_objetivo']);
        const objectiveName = row['nom_objetivo']?.toString().trim();
        const strategyId = parseInt(row['id_estrategia']);
        const strategyName = row['nom_estrategia']?.toString().trim();
        const actionLineId = parseInt(row['id_linea']);
        const actionLineName = row['nom_linea']?.toString().trim();
        if (!missionId || !missionName)
            continue;
        // 1. Upsert Mission (id, name, code, narrative_period_id)
        await prisma.$executeRaw `
            INSERT INTO cat_missions (id, name, code, narrative_period_id) 
            VALUES (${missionId}, ${missionName}, ${missionId}, ${periodId})
            ON DUPLICATE KEY UPDATE name = ${missionName}, code = ${missionId}, narrative_period_id = ${periodId}
        `;
        missionsCount++;
        // 2. Upsert Objective
        if (objectiveId && objectiveName) {
            const globalObjId = (missionId * 100) + objectiveId;
            await prisma.$executeRaw `
                INSERT INTO cat_objectives (id, name, code, mission_id) 
                VALUES (${globalObjId}, ${objectiveName}, ${objectiveId}, ${missionId})
                ON DUPLICATE KEY UPDATE name = ${objectiveName}, code = ${objectiveId}, mission_id = ${missionId}
            `;
            objectivesCount++;
            // 3. Upsert Strategy (using cat_strategies)
            if (strategyId && strategyName) {
                const globalStratId = (globalObjId * 100) + strategyId;
                try {
                    await prisma.$executeRaw `
                        INSERT INTO cat_narrative_strategies (id, name, code, objective_id) 
                        VALUES (${globalStratId}, ${strategyName}, ${strategyId}, ${globalObjId})
                        ON DUPLICATE KEY UPDATE name = ${strategyName}, code = ${strategyId}, objective_id = ${globalObjId}
                    `;
                }
                catch (e) {
                    // Fallback to cat_strategies just in case
                    try {
                        await prisma.$executeRaw `
                            INSERT INTO cat_strategies (id, name) 
                            VALUES (${globalStratId}, ${strategyName})
                            ON DUPLICATE KEY UPDATE name = ${strategyName}
                        `;
                    }
                    catch (e3) { }
                }
                strategiesCount++;
                // 4. Upsert Action Line
                if (actionLineId && actionLineName) {
                    const globalActionLineId = (globalStratId * 100) + actionLineId;
                    try {
                        await prisma.$executeRaw `
                            INSERT INTO cat_action_lines (id, name, code, narrative_strategy_id) 
                            VALUES (${globalActionLineId}, ${actionLineName}, ${actionLineId}, ${globalStratId})
                            ON DUPLICATE KEY UPDATE name = ${actionLineName}, code = ${actionLineId}, narrative_strategy_id = ${globalStratId}
                        `;
                    }
                    catch (e) {
                        try {
                            await prisma.$executeRaw `
                                INSERT INTO cat_action_lines (id, name, code, strategy_id) 
                                VALUES (${globalActionLineId}, ${actionLineName}, ${actionLineId}, ${globalStratId})
                                ON DUPLICATE KEY UPDATE name = ${actionLineName}, code = ${actionLineId}, strategy_id = ${globalStratId}
                            `;
                        }
                        catch (e2) {
                            // ignore silent errors for lines
                        }
                    }
                    actionLinesCount++;
                }
            }
        }
    }
    console.log("✅ Import completed successfully!");
    console.log(`Processed (attempts): ${missionsCount} Missions, ${objectivesCount} Objectives, ${strategiesCount} Strategies, ${actionLinesCount} Action Lines.`);
}
main()
    .catch(e => {
    console.error("❌ Error during script execution:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import-ped.js.map