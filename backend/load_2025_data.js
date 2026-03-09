/**
 * load_2025_data.ts
 * Copia los datos del periodo anterior ("5° Informe") al periodo 2026 como prueba.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const c = {
    ok: (s) => `\x1b[32m✅ ${s}\x1b[0m`,
    fail: (s) => `\x1b[31m❌ ${s}\x1b[0m`,
    warn: (s) => `\x1b[33m⚠️  ${s}\x1b[0m`,
    info: (s) => `\x1b[36mℹ️  ${s}\x1b[0m`,
    head: (s) => `\x1b[1m\x1b[35m\n${'─'.repeat(56)}\n ${s}\n${'─'.repeat(56)}\x1b[0m`,
};
async function run() {
    let copied = 0;
    let skipped = 0;
    let errors = 0;
    // 1. Mostrar todos los periodos
    console.log(c.head('PERIODOS DISPONIBLES EN LA BASE DE DATOS'));
    const allPeriods = await prisma.cat_periods.findMany({ orderBy: { id: 'asc' } });
    allPeriods.forEach((p) => console.log(c.info(`  ID:${p.id} → "${p.name}"`)));
    // 2. Buscar el periodo más reciente anterior a 2026 que tenga datos
    console.log(c.head('BUSCANDO PERIODO CON MÁS DATOS'));
    let sourcePeriod = null;
    let maxEntries = 0;
    for (const p of allPeriods) {
        if (p.name === '2026')
            continue; // Saltar el 2026
        const count = await prisma.entry.count({ where: { period_id: p.id } });
        console.log(c.info(`  Periodo "${p.name}" (ID:${p.id}) → ${count} filas de datos`));
        if (count > maxEntries) {
            maxEntries = count;
            sourcePeriod = p;
        }
    }
    if (!sourcePeriod || maxEntries === 0) {
        console.log(c.fail('No se encontraron datos en ningún periodo anterior.'));
        await prisma.$disconnect();
        return;
    }
    console.log(c.ok(`\nUsando periodo fuente: "${sourcePeriod.name}" (ID:${sourcePeriod.id}) con ${maxEntries} filas`));
    // 3. Asegurar periodo 2026
    let period2026 = await prisma.cat_periods.findFirst({ where: { name: '2026' } });
    if (!period2026) {
        period2026 = await prisma.cat_periods.create({
            data: { name: '2026', start_date: new Date('2026-01-01'), end_date: new Date('2026-12-31') }
        });
    }
    console.log(c.ok(`Periodo destino 2026: ID ${period2026.id}`));
    // 4. Obtener entries del periodo fuente con sus valores
    console.log(c.head(`CARGANDO DATOS DE "${sourcePeriod.name}"`));
    const sourceEntries = await prisma.entry.findMany({
        where: { period_id: sourcePeriod.id },
        include: { values: true },
        take: 50 // Máximo 50 filas como prueba
    });
    console.log(c.info(`Copiando ${sourceEntries.length} filas al periodo 2026...`));
    // Obtener usuario para created_by
    const firstUser = await prisma.user.findFirst({ where: { is_active: true } });
    const userId = firstUser?.id || BigInt(1);
    // 5. Copiar entries
    for (const entry of sourceEntries) {
        try {
            // Verificar si ya existe en 2026
            const existing = await prisma.entry.findFirst({
                where: { entity_id: entry.entity_id, period_id: period2026.id }
            });
            if (existing) {
                skipped++;
                continue;
            }
            // Crear nueva entry en 2026
            const newEntry = await prisma.entry.create({
                data: {
                    entity_id: entry.entity_id,
                    period_id: period2026.id,
                    created_by: userId,
                    updated_at: new Date()
                }
            });
            // Copiar los valores
            if (entry.values?.length > 0) {
                const valueData = entry.values.map((v) => ({
                    entry_id: newEntry.id,
                    property_id: v.property_id,
                    value: v.value || '',
                    created_by: userId
                }));
                await prisma.value.createMany({ data: valueData });
                copied++;
                // Obtener nombre de entidad para log
                const entityName = await prisma.entity.findUnique({
                    where: { id: entry.entity_id },
                    select: { name: true }
                });
                console.log(c.ok(`  [${copied}] Entidad ID:${entry.entity_id} "${String(entityName?.name || '').substring(0, 45)}" → ${entry.values.length} valores`));
            }
        }
        catch (e) {
            errors++;
            console.log(c.fail(`  Error en entidad ${entry.entity_id}: ${e.message.substring(0, 120)}`));
        }
    }
    // 6. Resumen
    console.log(c.head('RESUMEN FINAL'));
    console.log(c.ok(`  ${copied} entidades/filas copiadas al periodo 2026`));
    if (skipped > 0)
        console.log(c.warn(`  ${skipped} ya existían en 2026 (no duplicadas)`));
    if (errors > 0)
        console.log(c.fail(`  ${errors} errores`));
    console.log(c.info('\n  Recarga el módulo "Anexo Estadístico" → verás las matrices en verde con datos.'));
    console.log('');
    await prisma.$disconnect();
}
run().catch(async (e) => {
    console.error('Error inesperado:', e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=load_2025_data.js.map