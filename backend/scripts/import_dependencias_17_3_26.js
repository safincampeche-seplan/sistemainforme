import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function main() {
    const filePath = path.join(__dirname, '../../cat_dependencias (17.3.26).xlsx');
    console.log(`--- Importando Dependencias desde Excel: ${filePath} ---`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    let countAdded = 0;
    let countUpdated = 0;
    let countErrors = 0;
    const importedIds = [];
    // Empezamos desde la segunda fila (asumiendo que la fila 1 tiene encabezados)
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i).values;
        if (!row || row.length === 0)
            continue;
        // En excelJS las columnas empiezan en 1
        // Col 1: id_dependencia
        // Col 2: dependencia
        // Col 3: depnomcorto
        // Col 4: ejedep
        // Col 5: secretaria
        // Col 6: desconcentrado
        // Col 7: descentralizado
        // Col 8: fideicomiso
        // Col 9: empresa
        // Col 10: mision
        // Col 11: sector
        try {
            const idVal = row[1];
            if (!idVal || isNaN(Number(idVal.toString().trim() !== '' ? idVal : NaN)))
                continue;
            const id = BigInt(idVal);
            const name = String(row[2] || '').substring(0, 255).trim();
            const acronym = row[3] ? String(row[3]).substring(0, 50).trim() : null;
            const axis = row[4] ? String(row[4]).substring(0, 30).trim() : null;
            // Flags y IDs (ExcelJS a veces lee números, a veces valores vacíos)
            const isSecretary = !!row[5];
            const isDeconcentrated = !!row[6];
            const isDecentralized = !!row[7];
            const isCompany = !!row[9] || !!row[8]; // Agrupa empresa/fideicomiso
            const missionId = row[10] && !isNaN(Number(row[10])) ? BigInt(row[10]) : null;
            const sectorId = row[11] && !isNaN(Number(row[11])) ? BigInt(row[11]) : null;
            const updateData = {
                name,
                acronym,
                dependency_axis: axis,
                is_secretary: isSecretary,
                is_deconcentrated: isDeconcentrated,
                is_decentralized: isDecentralized,
                is_company: isCompany,
                mission_id: missionId,
                sector_id: sectorId,
                updated_at: new Date()
            };
            await prisma.dependency.upsert({
                where: { id },
                update: updateData,
                create: {
                    id,
                    ...updateData,
                    created_at: new Date()
                }
            });
            importedIds.push(id);
            console.log(`Guardado OK -> [ID: ${id}] ${name}`);
            countAdded++;
        }
        catch (err) {
            console.error(`Error en fila ${i} (ID: ${row[1]}):`, err);
            countErrors++;
        }
    }
    console.log(`\n=============================================`);
    console.log(`🔍 Iniciando proceso de SOFT-DELETE para dependencias obsoletas...`);
    // Soft delete all dependencies that were NOT included in this file run
    try {
        const softDeleteResult = await prisma.dependency.updateMany({
            where: {
                id: { notIn: importedIds },
                deleted_at: null // Solo borra las que no han sido borradas ya
            },
            data: {
                deleted_at: new Date(),
                edited_by: BigInt(1000) // Atribuido al usuario root/admin
            }
        });
        console.log(`🗑️ Dependencias deshabilitadas (Soft-Delete): ${softDeleteResult.count}`);
    }
    catch (err) {
        console.error("Error durante el proceso de Soft-Delete:", err);
    }
    console.log('\n=============================================');
    console.log(`✅ Importación Finalizada.`);
    console.log(`Filas Leídas: ${worksheet.rowCount - 1}`);
    console.log(`Registros Guardados/Actualizados: ${countAdded}`);
    console.log(`Errores: ${countErrors}`);
    console.log('=============================================\n');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import_dependencias_17_3_26.js.map