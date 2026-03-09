/**
 * verify_tables.ts
 * Prueba end-to-end del Anexo Estadístico usando Prisma directamente.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const c = {
    ok: (s) => `\x1b[32m✅ ${s}\x1b[0m`,
    fail: (s) => `\x1b[31m❌ ${s}\x1b[0m`,
    warn: (s) => `\x1b[33m⚠️  ${s}\x1b[0m`,
    info: (s) => `\x1b[36mℹ️  ${s}\x1b[0m`,
    head: (s) => `\x1b[1m\x1b[35m\n${'─'.repeat(52)}\n ${s}\n${'─'.repeat(52)}\x1b[0m`,
};
async function run() {
    let errors = 0;
    let warnings = 0;
    // ── PASO 1: Verificar entidades en la DB ──
    console.log(c.head('PASO 1: Entidades en Base de Datos'));
    let entities = [];
    try {
        entities = await prisma.entity.findMany({
            include: { properties: { orderBy: { id: 'asc' } } },
            orderBy: { id: 'asc' },
            take: 5 // Solo primeras 5 para el test
        });
        if (entities.length === 0) {
            console.log(c.fail('No hay entidades en la base de datos'));
            errors++;
        }
        else {
            console.log(c.ok(`Encontradas ${entities.length} entidades (mostrando primeras 5)`));
            for (const e of entities) {
                const propCount = e.properties?.length || 0;
                const hasMockIds = e.properties?.some((p) => Number(p.id) < 100);
                if (hasMockIds) {
                    console.log(c.warn(`  ID:${e.id} | "${String(e.name).substring(0, 50)}" | ${propCount} cols | ⚠️ IDs mock detectados`));
                    warnings++;
                }
                else {
                    console.log(c.ok(`  ID:${e.id} | "${String(e.name).substring(0, 50)}" | ${propCount} columnas reales`));
                }
            }
        }
    }
    catch (e) {
        console.log(c.fail(`Error al leer entidades: ${e.message}`));
        errors++;
    }
    if (entities.length === 0) {
        console.log(c.fail('No se puede continuar sin entidades. Abortando.'));
        await prisma.$disconnect();
        process.exit(1);
    }
    const testEntity = entities.find((e) => (e.properties?.length || 0) > 0);
    if (!testEntity) {
        console.log(c.warn('Ninguna de las primeras 5 entidades tiene propiedades. Buscando más...'));
        warnings++;
    }
    // ── PASO 2: Verificar propiedades de la primera entidad con props ──
    console.log(c.head('PASO 2: Propiedades de Entidad de Prueba'));
    if (!testEntity?.properties?.length) {
        console.log(c.fail('No se encontró entidad con propiedades para probar'));
        errors++;
    }
    else {
        console.log(c.ok(`Entidad de prueba: "${testEntity.name?.substring(0, 60)}" (ID: ${testEntity.id})`));
        console.log(c.info(`  ${testEntity.properties.length} propiedades:`));
        testEntity.properties.slice(0, 8).forEach((p) => {
            console.log(`    → ID ${p.id}: ${p.column_name} (${p.column_type})`);
        });
    }
    // ── PASO 3: Verificar o crear periodo 2026 ──
    console.log(c.head('PASO 3: Periodo 2026 en cat_periods'));
    let periodRecord = null;
    try {
        periodRecord = await prisma.cat_periods.findFirst({
            where: { name: '2026' }
        });
        if (!periodRecord) {
            periodRecord = await prisma.cat_periods.create({
                data: {
                    name: '2026',
                    start_date: new Date('2026-01-01'),
                    end_date: new Date('2026-12-31')
                }
            });
            console.log(c.ok(`Periodo 2026 creado con ID: ${periodRecord.id}`));
        }
        else {
            console.log(c.ok(`Periodo 2026 ya existe, ID: ${periodRecord.id}`));
        }
    }
    catch (e) {
        console.log(c.fail(`Error con el periodo: ${e.message}`));
        errors++;
    }
    // ── PASO 4: Insertar fila de prueba ──
    console.log(c.head('PASO 4: Insertar Fila de Prueba'));
    let createdEntryId = null;
    if (testEntity?.properties?.length && periodRecord) {
        const userId = BigInt(1); // ID genérico para el test
        // Intentar obtener un usuario real para el test
        try {
            const u = await prisma.user.findFirst({ where: { is_active: true } });
            const realUserId = u ? u.id : BigInt(1);
            // 1. Crear el Entry (fila)
            const newEntry = await prisma.entry.create({
                data: {
                    entity_id: BigInt(testEntity.id),
                    period_id: periodRecord.id,
                    created_by: realUserId,
                    updated_at: new Date()
                }
            });
            createdEntryId = newEntry.id;
            console.log(c.ok(`Entry creado con ID: ${newEntry.id}`));
            // 2. Crear Values para cada propiedad (máx 5)
            const valueData = testEntity.properties.slice(0, 5).map((p) => ({
                entry_id: newEntry.id,
                property_id: p.id,
                value: p.column_type?.includes('integer') ? '42' : 'PRUEBA_OK',
                created_by: realUserId
            }));
            await prisma.value.createMany({ data: valueData });
            console.log(c.ok(`${valueData.length} Values insertados correctamente`));
            console.log(c.info(`  Muestra: property_id=${valueData[0].property_id} → "${valueData[0].value}"`));
        }
        catch (e) {
            console.log(c.fail(`Error al insertar: ${e.message}`));
            errors++;
        }
    }
    else {
        console.log(c.warn('Saltando inserción (sin entidad o periodo válidos)'));
        warnings++;
    }
    // ── PASO 5: Recuperar la fila insertada ──
    console.log(c.head('PASO 5: Recuperar y Verificar Datos Guardados'));
    if (createdEntryId) {
        try {
            const retrieved = await prisma.entry.findUnique({
                where: { id: createdEntryId },
                include: { values: { include: { properties: true } } }
            });
            if (!retrieved) {
                console.log(c.fail('La fila insertada no se encontró en la DB'));
                errors++;
            }
            else {
                console.log(c.ok(`Fila recuperada con ${retrieved.values?.length || 0} valores`));
                retrieved.values?.forEach((v) => {
                    console.log(`    → ${v.properties?.column_name || 'propId:' + v.property_id}: "${v.value}"`);
                });
            }
        }
        catch (e) {
            console.log(c.fail(`Error al recuperar: ${e.message}`));
            errors++;
        }
    }
    else {
        console.log(c.warn('Saltando (no se insertó ninguna fila en el paso anterior)'));
    }
    // ── PASO 6: Limpiar datos de prueba ──
    console.log(c.head('PASO 6: Limpieza de Datos de Prueba'));
    if (createdEntryId) {
        try {
            await prisma.value.deleteMany({ where: { entry_id: createdEntryId } });
            await prisma.entry.delete({ where: { id: createdEntryId } });
            console.log(c.ok('Datos de prueba eliminados correctamente'));
        }
        catch (e) {
            console.log(c.warn(`No se pudo limpiar: ${e.message}`));
            warnings++;
        }
    }
    else {
        console.log(c.info('Nada que limpiar.'));
    }
    // ── RESUMEN ──
    console.log(c.head('RESUMEN FINAL'));
    if (errors === 0 && warnings === 0) {
        console.log(c.ok('✨ Todo funciona. El flujo de captura estadística es funcional.'));
    }
    else {
        if (errors > 0)
            console.log(c.fail(`${errors} error(es). Ver detalles arriba.`));
        if (warnings > 0)
            console.log(c.warn(`${warnings} advertencia(s). Ver detalles arriba.`));
    }
    console.log('');
    await prisma.$disconnect();
    process.exit(errors > 0 ? 1 : 0);
}
run().catch(async (e) => {
    console.error('Error inesperado:', e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=verify_tables.js.map