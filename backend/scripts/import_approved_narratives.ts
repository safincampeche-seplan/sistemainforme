import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const excelPath = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme/approved_narratives_4to_informe.xlsx';
    console.log(`\n🚀 Iniciando importación masiva de narrativas aprobadas...`);
    console.log(`📂 Archivo: ${excelPath}`);

    try {
        const workbook = XLSX.readFile(excelPath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(sheet);

        const totalItems = data.length;
        console.log(`📊 Registros encontrados en Excel: ${totalItems}`);

        let updatedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const [index, row] of data.entries()) {
            const sequenceNumber = row.sequence_number;
            const newNarrative = row.narrative_breakdows; // Match the column name in Excel
            const periodId = 4; // 4to Informe

            if (!sequenceNumber || !newNarrative) {
                console.warn(`⚠️ [${index + 1}/${totalItems}] Saltando fila incompleta: ${JSON.stringify(row)}`);
                skippedCount++;
                continue;
            }

            try {
                const updateResult = await prisma.narrativeCapture.updateMany({
                    where: {
                        sequence_number: sequenceNumber,
                        narrative_period_id: periodId
                    },
                    data: {
                        narrative_breakdown: newNarrative
                    }
                });

                if (updateResult.count > 0) {
                    updatedCount += updateResult.count;
                    if (updatedCount % 50 === 0) {
                        console.log(`✨ Progreso: ${updatedCount} registros actualizados...`);
                    }
                } else {
                    console.warn(`❓ [${index + 1}/${totalItems}] No se encontró registro en BD para Folio: ${sequenceNumber}`);
                    errorCount++;
                }
            } catch (err: any) {
                console.error(`❌ Error al actualizar Folio ${sequenceNumber}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\n✅ Proceso Finalizado:`);
        console.log(`   - Actualizados: ${updatedCount}`);
        console.log(`   - No encontrados: ${errorCount}`);
        console.log(`   - Saltados: ${skippedCount}`);
        console.log(`   - Total procesado: ${totalItems}\n`);

    } catch (error: any) {
        console.error(`💥 Error crítico en el proceso:`, error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
