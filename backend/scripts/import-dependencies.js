import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
const prisma = new PrismaClient();
async function main() {
    const excelPath = path.join(process.cwd(), '..', 'database', 'seeders', 'imports', 'cat_dependencias.xlsx');
    if (!fs.existsSync(excelPath)) {
        console.error('Archivo cat_dependencias.xlsx no encontrado en database/seeders/imports/');
        process.exit(1);
    }
    console.log('--- Iniciando importación de catálogo de dependencias (86 registros) ---');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log(`Leídas ${rows.length} filas del Excel.`);
    let count = 0;
    for (const row of rows) {
        const id = BigInt(row['id_dependencia']);
        const name = row['dependencia'];
        const acronym = row['depnomcorto'];
        const missionId = row['mision'] ? BigInt(Math.floor(Number(row['mision']))) : null;
        const sectorId = row['sector'] ? BigInt(Math.floor(Number(row['sector']))) : null;
        const isSecretary = row['secretaria'] == 1;
        const isDeconcentrated = row['desconcentrado'] == 1;
        const isDecentralized = row['descentralizado'] == 1;
        const isTrust = row['fideicomiso'] == 1;
        const isCompany = row['empresa'] == 1;
        if (!name)
            continue;
        await prisma.dependency.upsert({
            where: { id: id },
            update: {
                name: name,
                acronym: acronym,
                mission_id: missionId,
                sector_id: sectorId,
                is_secretary: isSecretary,
                is_deconcentrated: isDeconcentrated,
                is_decentralized: isDecentralized,
                is_trust: isTrust,
                is_company: isCompany,
                updated_at: new Date()
            },
            create: {
                id: id,
                name: name,
                acronym: acronym,
                mission_id: missionId,
                sector_id: sectorId,
                is_secretary: isSecretary,
                is_deconcentrated: isDeconcentrated,
                is_decentralized: isDecentralized,
                is_trust: isTrust,
                is_company: isCompany,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
        count++;
    }
    console.log(`--- Importación finalizada: ${count} dependencias procesadas ---`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import-dependencies.js.map