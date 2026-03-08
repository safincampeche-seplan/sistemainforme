import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const rootDir = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme';
    const csvPath = path.join(rootDir, 'catalogos_csv/cat_dependencies.csv');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    console.log('--- Importando Dependencias (Parser Manual V2) ---');
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        let row: any = {};

        // Estructura esperada (13 campos):
        // 0:id, 1:name, 2:acronym, 3:is_trust, 4:axis, 5:secretary, 6:deconc, 7:decent, 8:company, 9:mission_id, 10:sector_id, 11:created_at, 12:updated_at

        if (parts.length > 13) {
            // Caso con comas extras en el nombre (pueden ser muchas)
            row.id = parts[0];
            const last11 = parts.slice(-11); // Desde acronym hasta updated_at
            row.name = parts.slice(1, -11).join(',').trim();
            row.acronym = last11[0];
            row.mission_id = last11[7];
            row.sector_id = last11[8];
            row.created_at = last11[9];
            row.updated_at = last11[10];
        } else {
            row.id = parts[0];
            row.name = parts[1];
            row.acronym = parts[2];
            row.mission_id = parts[9];
            row.sector_id = parts[10];
            row.created_at = parts[11];
            row.updated_at = parts[12];
        }

        if (!row.id || isNaN(parseInt(row.id))) continue;

        try {
            await prisma.dependency.upsert({
                where: { id: BigInt(row.id) },
                update: {
                    name: String(row.name).substring(0, 255),
                    acronym: row.acronym && row.acronym !== 'NULL' ? String(row.acronym).substring(0, 50) : null,
                    mission_id: row.mission_id && row.mission_id !== 'NULL' ? BigInt(row.mission_id) : null,
                    sector_id: row.sector_id && row.sector_id !== 'NULL' ? BigInt(row.sector_id) : null,
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                },
                create: {
                    id: BigInt(row.id),
                    name: String(row.name).substring(0, 255),
                    acronym: row.acronym && row.acronym !== 'NULL' ? String(row.acronym).substring(0, 50) : null,
                    mission_id: row.mission_id && row.mission_id !== 'NULL' ? BigInt(row.mission_id) : null,
                    sector_id: row.sector_id && row.sector_id !== 'NULL' ? BigInt(row.sector_id) : null,
                    created_at: row.created_at && row.created_at !== 'NULL' ? new Date(row.created_at) : new Date(),
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                }
            });
            count++;
        } catch (err) {
            console.error(`Error en dependencia ID ${row.id} (${row.name}):`, err);
        }
    }

    console.log(`Dependencias procesadas con éxito: ${count}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
