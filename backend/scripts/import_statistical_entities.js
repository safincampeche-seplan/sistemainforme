import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import path from 'path';
const prisma = new PrismaClient();
async function main() {
    const rootDir = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme';
    const missions = [1, 2, 3, 4, 5];
    console.log('--- Cargando Mapas de Referencia ---');
    const deps = await prisma.dependency.findMany();
    // Mapeo de alias comunes
    const aliasMap = {
        'artec': 'Instituto de Cultura y Artes del Estado de Campeche',
        'seduo': 'Secretaría de Desarrollo Urbano, Movilidad y Obras Públicas ',
        'semaiges': 'Secretaría de Modernización Administrativa e Innovación Gubernamental',
        'safin': 'Secretaría de Administración y Finanzas',
        'secont': 'Secretaría de la Contraloría ',
        'spyc': 'Secretaría de Protección y Seguridad Ciudadana ',
        'sistema penitenciario': 'Subsecretaría del Sistema Penitenciario, Prevención y Reinserción Social del Estado',
        '2% sobre nominas': 'Fideicomiso de Inversión del Impuesto del 2% sobre nóminas ',
        '2% sobre nominas ': 'Fideicomiso de Inversión del Impuesto del 2% sobre nóminas '
    };
    let entityCount = 0;
    for (const missionNum of missions) {
        const filePath = path.join(rootDir, `Misión_${missionNum}_Anexo_2026.xlsx`);
        console.log(`Procesando archivo: Misión_${missionNum}_Anexo_2026.xlsx`);
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        for (const row of data) {
            const { titulo, dependencia, tipo, clave } = row;
            if (!titulo || !dependencia)
                continue;
            // 1. Mapeo de Dependencia
            let depNameSearch = dependencia.toString().trim().toLowerCase();
            if (aliasMap[depNameSearch]) {
                depNameSearch = aliasMap[depNameSearch].toLowerCase();
            }
            const dep = deps.find(d => d.name.trim().toLowerCase() === depNameSearch.trim() ||
                d.acronym?.toLowerCase() === depNameSearch.trim());
            if (!dep) {
                console.warn(`Dependencia no encontrada: ${dependencia} (Clave: ${clave})`);
                continue;
            }
            // 2. Determinar si es financiera
            const isFinancial = tipo?.toString().toLowerCase() === 'financiera';
            // 3. Upsert de la Entidad (Tabla Estadística)
            const existing = await prisma.entity.findFirst({
                where: {
                    name: titulo.toString().trim(),
                    dependency_id: dep.id,
                    period_id: 1
                }
            });
            if (existing) {
                await prisma.entity.update({
                    where: { id: existing.id },
                    data: { is_financial: isFinancial }
                });
            }
            else {
                await prisma.entity.create({
                    data: {
                        name: titulo.toString().trim(),
                        dependency_id: dep.id,
                        is_financial: isFinancial,
                        status: 'draft',
                        period_id: 1, // 2026
                        stage: 1,
                        source: `Importado de Misión ${missionNum}`,
                        notes: `Clave Excel: ${clave || 'N/A'}`
                    }
                });
            }
            entityCount++;
        }
    }
    console.log(`Importación de Entidades finalizada. Total: ${entityCount}`);
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=import_statistical_entities.js.map