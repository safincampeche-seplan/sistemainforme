/**
 * Seed: Catálogo de Programas Presupuestarios 2024
 * Importa los programas Estatales y Federales desde el Excel
 * a la tabla cat_budget_programs en la base de datos.
 *
 * Uso: npx ts-node --transpile-only seed_budget_programs.ts
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();
// ── DATOS EXTRAÍDOS DEL EXCEL ─────────────────────────────────────
// Hoja: TODOS ESTATALES
const estatales = [
    { code: 1, name: "Programa de Gestión y Operación Gubernamental" },
    { code: 2, name: "Gobernabilidad democrática" },
    { code: 3, name: "Programa de Justicia y Conciliación Laboral" },
    { code: 4, name: "Programa de Protección de la Seguridad Ciudadana y Vial" },
    { code: 6, name: "Programa de Inclusión y Cohesión Social" },
    { code: 7, name: "Programa de Acceso a Servicios Básicos" },
    { code: 8, name: "Programa de Acceso a la Salud Reproductiva" },
    { code: 9, name: "Programa de Atención de Personas en Situación de Vulnerabilidad" },
    { code: 10, name: "Programa de Atención al Envejecimiento" },
    { code: 12, name: "Programa de Acceso a la Alimentación" },
    { code: 13, name: "Programa de Salud Pública" },
    { code: 14, name: "Programa de Acceso a Servicios de Salud" },
    { code: 15, name: "Programa de Educación Básica" },
    { code: 16, name: "Programa de Educación Media Superior" },
    { code: 17, name: "Programa de Educación Superior y Posgrado" },
    { code: 18, name: "Programa de Capacitación para el Trabajo" },
    { code: 19, name: "Programa de Deporte y Actividad Física" },
    { code: 20, name: "Programa de Cultura y Artes" },
    { code: 21, name: "Programa de Fomento al Empleo" },
    { code: 22, name: "Programa de Economía y Competitividad" },
    { code: 23, name: "Programa de Fomento a la Inversión y Financiamiento" },
    { code: 24, name: "Programa de Fomento Agropecuario" },
    { code: 25, name: "Programa de Acuacultura y Pesca" },
    { code: 26, name: "Programa de Turismo" },
    { code: 27, name: "Programa de Infraestructura Carretera" },
    { code: 28, name: "Programa de Infraestructura Hidráulica" },
    { code: 29, name: "Programa de Vivienda" },
    { code: 30, name: "Programa de Desarrollo Urbano" },
    { code: 31, name: "Programa de Protección Ambiental" },
    { code: 32, name: "Programa de Agua Potable y Saneamiento" },
    { code: 33, name: "Programa de Gestión de Riesgos" },
    { code: 34, name: "Programa de Ciencia, Tecnología e Innovación" },
    { code: 35, name: "Programa de Gobierno Abierto y Transparencia" },
    { code: 36, name: "Programa de Igualdad de Género" },
    { code: 37, name: "Programa de Atención a Grupos Indígenas" },
    { code: 38, name: "Programa de Acceso a la Justicia" },
    { code: 39, name: "Programa de Derechos Humanos" },
    { code: 40, name: "Programa de Control y Evaluación de la Gestión Pública" },
    { code: 57, name: "Programa de Financiamiento Estatal" },
    { code: 59, name: "Conservación del Patrimonio Cultural del Estado" },
    { code: 60, name: "Sanidad e Inocuidad Agroalimentaria" },
];
// Hoja: TODOS FEDERALES
const federales = [
    { code: 5, name: "Fondo de Aportaciones para el Fortalecimiento de las Entidades Federativas (FAFEF)" },
    { code: 8, name: "Fondo de Aportaciones para la Seguridad Pública (FASP)" },
    { code: 15, name: "Fondo de Aportaciones para la Nómina Educativa y Gasto Operativo (FONE)" },
    { code: 17, name: "Fondo de Aportaciones Múltiples (FAM)" },
    { code: 20, name: "Fondo para Entidades Federativas y Municipios Productores de Hidrocarburos" },
    { code: 21, name: "Fondo de Aportaciones para los Servicios de Salud (FASSA)" },
    { code: 22, name: "Fondo de Infraestructura Social Estatal (FISE)" },
    { code: 23, name: "Fondo de Aportaciones para el Fortalecimiento de los Municipios (FORTAMUN-DF)" },
    { code: 24, name: "Programa de Desarrollo Institucional" },
    { code: 25, name: "Programa de Empleo Temporal (PET)" },
    { code: 30, name: "PROGRAMA DE BECAS DE EDUCACIÓN BÁSICA PARA EL BIENESTAR BENITO JUÁREZ" },
    { code: 33, name: "Registro de Programas Federales de Vivienda" },
    { code: 38, name: "Pensión para el Bienestar de las Personas Adultas Mayores" },
    { code: 40, name: "Programa de Fertilizantes" },
    { code: 41, name: "Sembrando Vida" },
    { code: 42, name: "Programa de Mejoramiento Urbano (PMU)" },
    { code: 43, name: "Programa de Atención a Zonas de Alta Marginación" },
    { code: 44, name: "Programa Nacional de Reconstrucción (PNR)" },
    { code: 45, name: "Tren Maya" },
    { code: 46, name: "IMSS-Bienestar" },
    { code: 47, name: "Programa Nacional de Salud Sexual y Reproductiva" },
    { code: 50, name: "Programa HÁBITAT" },
    { code: 51, name: "Programa Nacional de Prevención del Delito (PRONAPRED)" },
    { code: 55, name: "Agua Saludable para La Laguna" },
    { code: 65, name: "Programa de Infraestructura" },
    { code: 67, name: "Programa Nacional de Reconstrucción" },
    { code: 70, name: "Producción para el Bienestar" },
    { code: 80, name: "La Escuela es Nuestra" },
    { code: 85, name: "Programa de Becas de Educación Media Superior (PREPA SÍ)" },
    { code: 90, name: "Jóvenes Escribiendo el Futuro" },
    { code: 100, name: "Programa de Apoyo a Instancias de Mujeres en las Entidades Federativas (PAIMEF)" },
    { code: 105, name: "Programa de Apoyo a las Instancias de Mujeres en las Entidades Federativas (PAIMEF)" },
    { code: 122, name: "Pensión para el Bienestar de las Personas con Discapacidad Permanente" },
    { code: 130, name: "Programa de Becas para Estudiantes Indígenas" },
];
async function main() {
    console.log("🌱 Iniciando seed de Programas Presupuestarios 2024...\n");
    // Verificar conexión
    await prisma.$queryRaw `SELECT 1`;
    console.log("✅ Conexión a la base de datos estable.");
    // Contar registros existentes
    const existingCount = await prisma.budgetProgram.count();
    console.log(`📊 Registros actuales en cat_budget_programs: ${existingCount}`);
    if (existingCount > 0) {
        console.log("\n⚠️  Ya existen programas presupuestarios en la DB.");
        const res = await prisma.budgetProgram.findMany({ take: 5, select: { id: true, code: true, name: true, type: true } });
        console.log("Muestra de registros existentes:", res);
        console.log("\nEliminando registros existentes para re-importar...");
        await prisma.budgetProgram.deleteMany({});
        console.log("🗑️  Registros eliminados.");
    }
    // Insertar Estatales
    console.log(`\n📥 Insertando ${estatales.length} Programas Estatales...`);
    for (const p of estatales) {
        await prisma.budgetProgram.create({
            data: { name: p.name, code: p.code, type: "Estatal" }
        });
    }
    console.log(`✅ ${estatales.length} programas Estatales insertados.`);
    // Insertar Federales
    console.log(`\n📥 Insertando ${federales.length} Programas Federales...`);
    for (const p of federales) {
        await prisma.budgetProgram.create({
            data: { name: p.name, code: p.code, type: "Federal" }
        });
    }
    console.log(`✅ ${federales.length} programas Federales insertados.`);
    // Verificación final
    const totalCount = await prisma.budgetProgram.count();
    const byType = await prisma.budgetProgram.groupBy({
        by: ['type'],
        _count: { _all: true }
    });
    console.log(`\n🎉 Importación completada!`);
    console.log(`   Total en DB: ${totalCount} programas`);
    byType.forEach(g => console.log(`   - ${g.type}: ${g._count._all}`));
}
main()
    .catch(e => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed_budget_programs.js.map