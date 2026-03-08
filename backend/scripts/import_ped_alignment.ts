
import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const rootDir = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme';
    const pedPath = path.join(rootDir, 'alineación_ped_2024.xlsx');

    console.log('--- Importando Alineación PED (Objetivos, Estrategias, Líneas) ---');
    const workbook = xlsx.readFile(pedPath);

    let objCount = 0;
    let straCount = 0;
    let lineCount = 0;

    for (const sheetName of workbook.SheetNames) {
        console.log(`Procesando hoja: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        // La fila 0 es el título ("ALINEACIÓN DEL PED..."), la fila 1 son las cabeceras
        const data: any[] = xlsx.utils.sheet_to_json(sheet, { range: 1 });

        for (const row of data) {
            const {
                id_mision,
                id_objetivo, nom_objetivo,
                id_estrategia, nom_estrategia,
                id_linea, nom_linea
            } = row;

            if (!id_mision || !id_objetivo) continue;

            // 1. Objetivo
            const objective = await prisma.cat_objectives.upsert({
                where: { id: BigInt(id_objetivo) },
                update: { name: nom_objetivo, code: id_objetivo, mission_id: BigInt(id_mision) },
                create: { id: BigInt(id_objetivo), name: nom_objetivo, code: id_objetivo, mission_id: BigInt(id_mision) }
            });
            objCount++;

            // 2. Estrategia
            if (id_estrategia && nom_estrategia) {
                const strategy = await prisma.cat_narrative_strategies.upsert({
                    where: { id: BigInt(id_estrategia) },
                    update: { name: nom_estrategia, code: id_estrategia, objective_id: objective.id },
                    create: { id: BigInt(id_estrategia), name: nom_estrategia, code: id_estrategia, objective_id: objective.id }
                });
                straCount++;

                // 3. Línea de Acción
                if (id_linea && nom_linea) {
                    await prisma.cat_action_lines.upsert({
                        where: { id: BigInt(id_linea) },
                        update: { name: nom_linea, code: id_linea, narrative_strategy_id: strategy.id },
                        create: { id: BigInt(id_linea), name: nom_linea, code: id_linea, narrative_strategy_id: strategy.id }
                    });
                    lineCount++;
                }
            }
        }
    }

    console.log(`Importación finalizada: ${objCount} Objetivos, ${straCount} Estrategias, ${lineCount} Líneas.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
