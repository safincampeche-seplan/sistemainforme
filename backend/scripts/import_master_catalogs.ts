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

    console.log('--- Importando Sectores ---');
    const sectorData: any[] = importCSV('cat_sectors.csv');
    for (const row of sectorData) {
        try {
            await prisma.cat_sectors.upsert({
                where: { id: BigInt(row.id) },
                update: {
                    name: String(row.name).substring(0, 255),
                    acronym: String(row.acronym || '').substring(0, 15),
                    description: row.description ? String(row.description).substring(0, 255) : null,
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                },
                create: {
                    id: BigInt(row.id),
                    name: String(row.name).substring(0, 255),
                    acronym: String(row.acronym || '').substring(0, 15),
                    description: row.description ? String(row.description).substring(0, 255) : null,
                    created_at: row.created_at && row.created_at !== 'NULL' ? new Date(row.created_at) : new Date(),
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                }
            });
        } catch (err) {
            console.error(`Error en sector ID ${row.id}:`, err);
        }
    }

    console.log('--- Importando Misiones (Ejes PED) ---');
    const missionData: any[] = importCSV('cat_missions.csv');
    for (const row of missionData) {
        try {
            await prisma.mission.upsert({
                where: { id: BigInt(row.id) },
                update: {
                    name: String(row.name).substring(0, 255),
                    code: parseInt(row.code || row.id),
                    narrative_period_id: BigInt(row.narrative_period_id || 1),
                    title_color: row.title_color ? String(row.title_color).substring(0, 6) : null,
                    theme_color: row.theme_color ? String(row.theme_color).substring(0, 6) : null,
                    subtheme_color: row.subtheme_color ? String(row.subtheme_color).substring(0, 6) : null,
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                },
                create: {
                    id: BigInt(row.id),
                    name: String(row.name).substring(0, 255),
                    code: parseInt(row.code || row.id),
                    narrative_period_id: BigInt(row.narrative_period_id || 1),
                    title_color: row.title_color ? String(row.title_color).substring(0, 6) : null,
                    theme_color: row.theme_color ? String(row.theme_color).substring(0, 6) : null,
                    subtheme_color: row.subtheme_color ? String(row.subtheme_color).substring(0, 6) : null,
                    created_at: row.created_at && row.created_at !== 'NULL' ? new Date(row.created_at) : new Date(),
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                }
            });
        } catch (err) {
            console.error(`Error en misión ID ${row.id}:`, err);
        }
    }

    console.log('--- Importando Dependencias ---');
    const depData: any[] = importCSV('cat_dependencies.csv');
    let count = 0;
    for (const row of depData) {
        try {
            await prisma.dependency.upsert({
                where: { id: BigInt(row.id) },
                update: {
                    name: String(row.name).substring(0, 255),
                    acronym: String(row.acronym || '').substring(0, 50),
                    mission_id: row.mission_id && row.mission_id !== 'NULL' ? BigInt(row.mission_id) : null,
                    sector_id: row.sector_id && row.sector_id !== 'NULL' ? BigInt(row.sector_id) : null,
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                },
                create: {
                    id: BigInt(row.id),
                    name: String(row.name).substring(0, 255),
                    acronym: String(row.acronym || '').substring(0, 50),
                    mission_id: row.mission_id && row.mission_id !== 'NULL' ? BigInt(row.mission_id) : null,
                    sector_id: row.sector_id && row.sector_id !== 'NULL' ? BigInt(row.sector_id) : null,
                    created_at: row.created_at && row.created_at !== 'NULL' ? new Date(row.created_at) : new Date(),
                    updated_at: row.updated_at && row.updated_at !== 'NULL' ? new Date(row.updated_at) : new Date()
                }
            });
            count++;
        } catch (err) {
            console.error(`Error en dependencia ID ${row.id}:`, err);
        }
    }
    console.log(`Dependencias importadas/sincronizadas: ${count}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
