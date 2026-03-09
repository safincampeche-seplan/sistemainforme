const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Iniciando sembrado final de catálogos...");

    // 1. Catálogo de Períodos
    console.log("📅 Configurando Períodos...");
    const periods = [
        { id: 1, name: "Primer Informe de Gobierno", year: "2025" },
        { id: 2, name: "Segundo Informe de Gobierno", year: "2026" }
    ];
    for (const p of periods) {
        await prisma.cat_narrative_periods.upsert({
            where: { id: BigInt(p.id) },
            update: { name: p.name, year: p.year },
            create: { id: BigInt(p.id), name: p.name, year: p.year }
        });
    }

    // 2. Catálogo de Sectores (Estándar Campeche)
    console.log("📁 Configurando Sectores...");
    const sectors = [
        { id: 1, name: "Gobernabilidad", acronym: "GOB" },
        { id: 2, name: "Seguridad y Justicia", acronym: "SEG" },
        { id: 3, name: "Desarrollo Económico", acronym: "ECO" },
        { id: 4, name: "Desarrollo Social", acronym: "SOC" },
        { id: 5, name: "Educación", acronym: "EDU" },
        { id: 6, name: "Salud", acronym: "SAL" },
        { id: 7, name: "Infraestructura", acronym: "INF" },
        { id: 8, name: "Medio Ambiente", acronym: "MED" }
    ];
    for (const s of sectors) {
        await prisma.cat_sectors.upsert({
            where: { id: BigInt(s.id) },
            update: { name: s.name, acronym: s.acronym },
            create: { id: BigInt(s.id), name: s.name, acronym: s.acronym }
        });
    }

    // 3. Extracción de ppas_catalog.json (PPAs, Misiones/Ejes, Temas)
    const ppasPath = path.join(__dirname, 'ppas_catalog.json');
    if (fs.existsSync(ppasPath)) {
        console.log("🔍 Procesando ppas_catalog.json...");
        const ppas = JSON.parse(fs.readFileSync(ppasPath, 'utf8'));

        const uniqueTitles = new Set();
        const ppaTypes = new Set();

        ppas.forEach(p => {
            if (p.titulo) uniqueTitles.add(p.titulo);
            if (p.tipo_ppa) ppaTypes.add(p.tipo_ppa);
        });

        // 3.1 Tipos de PPA
        console.log("🏷️  Configurando Tipos de PPA...");
        let ppaId = 1;
        for (const type of ppaTypes) {
            await prisma.cat_ppas_types.upsert({
                where: { id: BigInt(ppaId) },
                update: { name: type },
                create: { id: BigInt(ppaId), name: type, acronym: type.substring(0, 5).toUpperCase() }
            });
            ppaId++;
        }

        // 3.2 Misiones (Ejes PED)
        console.log("🚀 Configurando Misiones (Ejes PED)...");
        let mId = 1;
        for (const title of uniqueTitles) {
            await prisma.mission.upsert({
                where: { id: BigInt(mId) },
                update: { name: title },
                create: {
                    id: BigInt(mId),
                    name: title,
                    code: mId,
                    narrative_period_id: BigInt(2) // Default 2026
                }
            });
            mId++;
        }
    } else {
        console.warn("⚠️ ppas_catalog.json no encontrado, omitiendo extracción de PPAs/Misiones.");
    }

    // 4. Municipios de Campeche
    console.log("🗺️  Configurando Municipios...");
    const municipalities = [
        "Calkiní", "Campeche", "Carmen", "Champotón", "Hecelchakán",
        "Hopelchén", "Palizada", "Tenabo", "Escárcega", "Calakmul",
        "Candelaria", "Seybaplaya", "Dzitbalché"
    ];
    for (let i = 0; i < municipalities.length; i++) {
        await prisma.cat_municipalities.upsert({
            where: { id: BigInt(i + 1) },
            update: { name: municipalities[i] },
            create: { id: BigInt(i + 1), name: municipalities[i] }
        });
    }

    // 5. Localidades Mínimas (Placeholder para evitar SIN REGISTROS)
    console.log("📍 Configurando Localidades principales...");
    const mainLocalities = [
        { id: 1, name: "San Francisco de Campeche", mun_id: 2 },
        { id: 2, name: "Ciudad del Carmen", mun_id: 3 },
        { id: 3, name: "Champotón", mun_id: 4 },
        { id: 4, name: "Escárcega", mun_id: 9 },
        { id: 5, name: "Calkiní", mun_id: 1 }
    ];
    for (const loc of mainLocalities) {
        await prisma.cat_localities.upsert({
            where: { id: BigInt(loc.id) },
            update: { name: loc.name, municipality_id: BigInt(loc.mun_id), code: "0001" },
            create: { id: BigInt(loc.id), name: loc.name, municipality_id: BigInt(loc.mun_id), code: "0001" }
        });
    }

    console.log("✅ Sembrado completado con éxito.");
}

main()
    .catch(e => {
        console.error("❌ Error durante el sembrado:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
