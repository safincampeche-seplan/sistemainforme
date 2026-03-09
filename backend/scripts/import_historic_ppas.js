import { PrismaClient, narrative_captures_status } from "@prisma/client";
import xlsx from 'xlsx';
import path from 'path';
const prisma = new PrismaClient();
async function main() {
    const rootDir = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme';
    const ppasPath = path.join(rootDir, 'input_bd_ppas_5toinforme (2).xlsx');
    console.log('--- Cargando Mapas de Referencia ---');
    const deps = await prisma.dependency.findMany();
    const titles = await prisma.narrativeTitle.findMany();
    const themes = await prisma.narrativeTheme.findMany();
    const subthemes = await prisma.cat_narrative_sub_themes.findMany();
    const ppaTypes = await prisma.cat_ppas_types.findMany();
    const budgetProgs = await prisma.budgetProgram.findMany();
    const odsList = await prisma.odsLinkage.findMany();
    const periods = await prisma.cat_narrative_periods.findMany();
    // Buscar periodo 2025
    let period2025 = periods.find(p => p.year === '2025');
    if (!period2025) {
        console.log('Creando periodo 2025...');
        period2025 = await prisma.cat_narrative_periods.create({
            data: { name: 'Quinto Informe de Gobierno', year: '2025' }
        });
    }
    const workbook = xlsx.readFile(ppasPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`--- Importando ${data.length} PPAs Históricos ---`);
    let count = 0;
    for (const row of data) {
        try {
            // 1. Mapeo de Catálogos
            const dep = deps.find(d => d.name.trim().toLowerCase() === row['DEPENDENCIA']?.toString().trim().toLowerCase());
            const title = titles.find(t => t.name.trim().toLowerCase() === row['TÍTULO']?.toString().trim().toLowerCase());
            const theme = themes.find(t => t.name?.trim().toLowerCase() === row['TEMA']?.toString().trim().toLowerCase());
            const subtheme = subthemes.find(t => t.name?.trim().toLowerCase() === row['SUBTEMA']?.toString().trim().toLowerCase());
            const ppaType = ppaTypes.find(t => t.name.trim().toLowerCase() === row['TIPO PPA']?.toString().trim().toLowerCase());
            // Programa Presupuestario (extraer código del string, ej "001 PROGRAMA...")
            const progMatch = row['PROGRAMA PRESUPUESTARIO']?.toString().match(/^(\d+)/);
            const progCode = progMatch ? parseInt(progMatch[1]) : null;
            const budgetProg = budgetProgs.find(b => Number(b.code) === progCode);
            // 2. Normalización de datos numéricos
            const investment = parseFloat(row['MONTO DE INVERSIÓN']?.toString().replace(/[^0-9.-]+/g, "")) || 0;
            const beneficiariesCount = parseInt(row['BENEFICIARIOS']) || 0;
            // 3. Estatus
            let status = narrative_captures_status.historical__revised_;
            if (row['ESTATUS']?.toString().toLowerCase().includes('borrador'))
                status = narrative_captures_status.draft;
            if (row['ESTATUS']?.toString().toLowerCase().includes('validación'))
                status = narrative_captures_status.under_validation_semaig;
            if (row['ESTATUS']?.toString().toLowerCase().includes('aprobado'))
                status = narrative_captures_status.approved_secont;
            // 4. Creación del Registro
            const capture = await prisma.narrativeCapture.upsert({
                where: {
                    sequence_number_narrative_period_id: {
                        sequence_number: row['CLAVE']?.toString() || `HIST-${Date.now()}-${count}`,
                        narrative_period_id: period2025.id
                    }
                },
                update: {}, // No actualizar si ya existe para evitar duplicados en re-ejecución
                create: {
                    sequence_number: row['CLAVE']?.toString() || `HIST-${Date.now()}-${count}`,
                    narrative_period_id: period2025.id,
                    dependency_id: dep?.id,
                    narrative_title_id: title?.id,
                    narrative_theme_id: theme?.id,
                    narrative_sub_theme_id: subtheme?.id,
                    ppa_name: row['NOMBRE PPA']?.toString() || "Sin Nombre",
                    ppas_type_id: ppaType?.id,
                    investment_amount: investment,
                    beneficiaries: beneficiariesCount,
                    budget_program_id: budgetProg?.id,
                    narrative_breakdown: row['NARRATIVA']?.toString() || "Sin descripción",
                    status: status,
                    peds: row['VINCULACIÓN PED'] ? { raw: row['VINCULACIÓN PED'] } : {},
                    locations: row['UBICACIONES'] ? { raw: row['UBICACIONES'] } : {},
                    created_at: row['FECHA DE ACTUALIZACIÓN'] ? new Date(row['FECHA DE ACTUALIZACIÓN']) : new Date()
                }
            });
            // 5. Vincular ODS si existen
            if (row['VINCULACIÓN ODS']) {
                const odsTarget = row['VINCULACIÓN ODS'].toString();
                for (const ods of odsList) {
                    if (odsTarget.includes(ods.code.toString()) || odsTarget.toLowerCase().includes(ods.name.toLowerCase())) {
                        await prisma.ods_linkage_narrative.upsert({
                            where: { ods_linkage_id_narrative_capture_id: { ods_linkage_id: ods.id, narrative_capture_id: capture.id } },
                            update: {},
                            create: { ods_linkage_id: ods.id, narrative_capture_id: capture.id }
                        }).catch(() => { });
                    }
                }
            }
            count++;
            if (count % 10 === 0)
                console.log(`Procesados ${count} registros...`);
        }
        catch (err) {
            console.error(`Error en fila ${count}:`, err);
        }
    }
    console.log(`Importación finalizada. Total exitosos: ${count}`);
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=import_historic_ppas.js.map