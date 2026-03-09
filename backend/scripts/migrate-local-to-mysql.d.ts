/**
 * migrate-local-to-mysql.ts
 *
 * Script de migración: transfiere narrativas guardadas en el JSON local
 * (modo offline / respaldo) hacia la base de datos MySQL oficial (via Prisma).
 *
 * EJECUCIÓN:
 *   cd backend
 *   npx ts-node --esm scripts/migrate-local-to-mysql.ts
 *
 * SEGURIDAD:
 *   - Solo inserta registros que NO existen en MySQL (sin duplicados).
 *   - Los IDs del JSON local (timestamp) se descarten y MySQL genera nuevos IDs.
 *   - Se muestra un resumen al final con cuántos se migró vs. saltó.
 */
export {};
//# sourceMappingURL=migrate-local-to-mysql.d.ts.map