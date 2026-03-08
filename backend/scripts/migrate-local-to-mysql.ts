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

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Localizar archivos JSON de respaldo ──────────────────────────────────────
const DATA_DIR = path.join(__dirname, "..", "data");

function getAllLocalFiles(): string[] {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith("local_data") && f.endsWith(".json"))
        .map(f => path.join(DATA_DIR, f));
}

function getPeriodFromFilename(filename: string): number {
    const match = path.basename(filename).match(/_(\d{4})\.json$/);
    return match ? parseInt(match[1]) : 2026;
}

// ── Mapeo de periodo a narrative_period_id ───────────────────────────────────
function periodToNarrativePeriodId(year: number): number {
    return year === 2026 ? 5 : 4;
}

// ── Mapeo de estatus legible a código DB ─────────────────────────────────────
function mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
        "borrador": "draft",
        "draft": "draft",
        "en validación": "under_validation_semaig",
        "under_validation": "under_validation_semaig",
        "under_validation_semaig": "under_validation_semaig",
        "observado": "observed",
        "observed": "observed",
        "aprobado": "approved",
        "approved": "approved",
    };
    return statusMap[status?.toLowerCase()] ?? "draft";
}

// ── Script principal ─────────────────────────────────────────────────────────
async function main() {
    console.log("🚀 Iniciando migración de datos locales → MySQL...\n");

    const files = getAllLocalFiles();

    if (files.length === 0) {
        console.log("⚠️  No se encontraron archivos de respaldo local en:", DATA_DIR);
        console.log("   (Si usas un nombre distinto, busca en la raíz de /backend el archivo local_data.json o similar)");
        return;
    }

    console.log(`📂 Archivos de respaldo encontrados: ${files.length}`);
    files.forEach(f => console.log("   •", path.basename(f)));
    console.log();

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const filePath of files) {
        const period = getPeriodFromFilename(filePath);
        console.log(`\n📅 Procesando periodo ${period} (${path.basename(filePath)})...`);

        let localData: any;
        try {
            localData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch (err) {
            console.error(`  ❌ No se pudo leer el archivo: ${err}`);
            totalErrors++;
            continue;
        }

        const narratives: any[] = localData.narratives || [];
        if (narratives.length === 0) {
            console.log("  ℹ️  Sin narrativas en este archivo.");
            continue;
        }

        console.log(`  📝 Narrativas en JSON: ${narratives.length}`);

        for (const n of narratives) {
            // Verificar si ya existe en MySQL (por ppa_name + dependency_id + periodo)
            try {
                const depId = n.dependency_id ? BigInt(n.dependency_id) : null;
                const existing = await (prisma as any).narrativeCapture.findFirst({
                    where: {
                        ppa_name: n.ppa_name,
                        dependency_id: depId,
                        narrative_period_id: periodToNarrativePeriodId(n.periodo || period),
                    }
                });

                if (existing) {
                    console.log(`  ⏭️  Saltando (ya existe): "${n.ppa_name?.substring(0, 50)}"`);
                    totalSkipped++;
                    continue;
                }

                // Insertar en MySQL
                await (prisma as any).narrativeCapture.create({
                    data: {
                        ppa_name: n.ppa_name || "Sin nombre",
                        investment_amount: n.investment_amount || null,
                        beneficiaries: parseInt(n.beneficiaries) || 0,
                        narrative_breakdown: n.narrative_breakdown || "",
                        highlighted: n.highlighted || "",
                        narrative_period_id: periodToNarrativePeriodId(n.periodo || period),
                        status: mapStatus(n.status),
                        dependency_id: depId,
                        narrative_title_id: n.title_id ? parseInt(n.title_id) : null,
                        narrative_theme_id: n.theme_id ? parseInt(n.theme_id) : null,
                        narrative_sub_theme_id: n.subtheme_id ? parseInt(n.subtheme_id) : null,
                        narrative_financing_source_id: n.financing_source_id ? parseInt(n.financing_source_id) : null,
                        narrative_beneficiary_type_id: n.beneficiary_type_id ? parseInt(n.beneficiary_type_id) : null,
                        budget_program_id: n.budget_program_id ? parseInt(n.budget_program_id) : null,
                        sequence_number: `MIGR-${Date.now().toString().slice(-6)}`,
                    }
                });

                console.log(`  ✅ Migrado: "${n.ppa_name?.substring(0, 50)}"`);
                totalMigrated++;

                // Pequeña pausa para evitar saturar la BD
                await new Promise(r => setTimeout(r, 50));

            } catch (err: any) {
                console.error(`  ❌ Error al migrar "${n.ppa_name}": ${err.message}`);
                totalErrors++;
            }
        }
    }

    console.log("\n═══════════════════════════════════════");
    console.log("📊 RESUMEN DE MIGRACIÓN:");
    console.log(`   ✅ Migradas exitosamente: ${totalMigrated}`);
    console.log(`   ⏭️  Saltadas (ya existían): ${totalSkipped}`);
    console.log(`   ❌ Errores:               ${totalErrors}`);
    console.log("═══════════════════════════════════════\n");

    if (totalMigrated > 0) {
        console.log("💡 Las narrativas migradas ahora aparecerán en 'Mis Capturas' con badge 'Sincronizado'.");
    }
}

main()
    .catch(err => {
        console.error("Error fatal durante la migración:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
