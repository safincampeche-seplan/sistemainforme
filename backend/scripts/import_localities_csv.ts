import { PrismaClient } from '@prisma/client';
import path from 'path';
import xlsx from 'xlsx';

const prisma = new PrismaClient();

async function main() {
    const rootDir = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme';
    const csvDir = path.join(rootDir, 'catalogos_csv');

    const importCSV = (filename: string) => {
        const filePath = path.join(csvDir, filename);
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return xlsx.utils.sheet_to_json(sheet);
    };

    console.log('--- Importando Municipios ---');
    const munData: any[] = importCSV('cat_municipalities.csv');

    for (const row of munData) {
        await prisma.cat_municipalities.upsert({
            where: { id: BigInt(row.id) },
            update: {
                name: String(row.name),
                updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
            },
            create: {
                id: BigInt(row.id),
                name: String(row.name),
                created_at: row.created_at && row.created_at !== 'NULL' ? new Date(row.created_at) : new Date(),
                updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
            }
        });
    }
    console.log(`Municipios importados: ${munData.length}`);

    console.log('--- Importando Localidades ---');
    const locData: any[] = importCSV('cat_localities.csv');

    let count = 0;
    for (const row of locData) {
        try {
            await prisma.cat_localities.upsert({
                where: { id: BigInt(row.id) },
                update: {
                    name: String(row.name),
                    code: String(row.code || ''),
                    municipality_id: BigInt(row.municipality_id),
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                },
                create: {
                    id: BigInt(row.id),
                    name: String(row.name),
                    code: String(row.code || ''),
                    municipality_id: BigInt(row.municipality_id),
                    created_at: row.created_at && row.created_at !== 'NULL' ? new Date(row.created_at) : new Date(),
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                }
            });
            count++;
            if (count % 500 === 0) console.log(`Progreso: ${count} localidades...`);
        } catch (err) {
            console.error(`Error en localidad ID ${row.id}:`, err);
        }
    }
    console.log(`Localidades importadas: ${count}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
