import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("🌱 Extrayendo catálogos desde ppas_catalog.json...");

    // Fallback static lists in case JSON is missing or incomplete
    const beneficiariesFallback = ['Personas', 'Familias', 'Localidades', 'Municipios', 'Escuelas', 'Productores', 'Mujeres', 'Niñas y Niños'];
    const sourcesFallback = ['Estatal', 'Federal', 'Convenios', 'Recursos Propios', 'FISM', 'FORTAMUN'];

    const ppasFile = path.join(__dirname, 'ppas_catalog.json');
    let ppas: any[] = [];
    if (fs.existsSync(ppasFile)) {
        ppas = JSON.parse(fs.readFileSync(ppasFile, 'utf8'));
    } else {
        console.log("⚠️ no ppas_catalog.json found. Proceeding with basic standard lists only.");
    }

    // Ensure Mission 1 and Period
    const period = await prisma.cat_narrative_periods.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: '5to Informe de Gobierno', year: '2026' }
    });

    const mission = await prisma.mission.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: 'Gobierno Honesto y Transparente', code: 1, narrative_period_id: period.id }
    });

    const titles = new Set<string>();
    const themes = new Map<string, string>(); // tema -> titulo
    const subthemes = new Map<string, string>(); // subtema -> tema
    const ppaTypes = new Set<string>();
    const fundings = new Set<string>(sourcesFallback);
    const beneficiaries = new Set<string>(beneficiariesFallback);
    const budgetPrograms = new Map<string, { code: number, name: string }>();

    for (const p of ppas) {
        if (p.titulo) titles.add(p.titulo);
        if (p.tema && p.titulo) themes.set(p.tema, p.titulo);
        if (p.subtema && p.tema) subthemes.set(p.subtema, p.tema);
        if (p.tipo_ppa) ppaTypes.add(p.tipo_ppa);
        if (p.fuente) fundings.add(p.fuente);
        if (p.tipo_beneficiario) beneficiaries.add(p.tipo_beneficiario);

        if (p.programa_presupuestario) {
            const match = p.programa_presupuestario.match(/^(\d+)/);
            const code = match ? parseInt(match[1]) : 0;
            budgetPrograms.set(p.programa_presupuestario, { code, name: p.programa_presupuestario });
        }
    }

    console.log(`Extracted: ${titles.size} Títulos, ${themes.size} Temas, ${subthemes.size} Subtemas`);

    let tCode = 1;
    for (const titleName of titles) {
        try {
            const title = await prisma.narrativeTitle.findFirst({ where: { name: titleName.toString() } });
            if (!title) {
                await prisma.narrativeTitle.create({
                    data: { name: titleName.toString(), code: tCode++, mission_id: mission.id }
                });
            }
        } catch (e) { console.error("Error with title", titleName); }
    }

    let thCode = 1;
    for (const [themeName, titleName] of themes.entries()) {
        try {
            const title = await prisma.narrativeTitle.findFirst({ where: { name: titleName.toString() } });
            const theme = await prisma.narrativeTheme.findFirst({ where: { name: themeName.toString() } });
            if (title && !theme) {
                await prisma.narrativeTheme.create({
                    data: { name: themeName.toString(), code: thCode++, narrative_title_id: title.id }
                });
            }
        } catch (e) { console.error("Error with theme", themeName); }
    }

    let sCode = 1;
    for (const [subthemeName, themeName] of subthemes.entries()) {
        try {
            const theme = await prisma.narrativeTheme.findFirst({ where: { name: themeName.toString() } });
            const sub = await (prisma as any).cat_narrative_sub_themes.findFirst({ where: { name: subthemeName.toString() } });
            if (theme && !sub) {
                await (prisma as any).cat_narrative_sub_themes.create({
                    data: { name: subthemeName.toString(), code: sCode++, narrative_theme_id: theme.id }
                });
            }
        } catch (e) { console.error("Error with subtheme", subthemeName); }
    }

    for (const type of ppaTypes) {
        try {
            const pt = await (prisma as any).cat_ppas_types.findFirst({ where: { name: type.toString() } });
            if (!pt) await (prisma as any).cat_ppas_types.create({ data: { name: type.toString(), acronym: type.toString().substring(0, 5) } });
        } catch (e) { /* ignore */ }
    }

    for (const fund of fundings) {
        try {
            const fs = await (prisma as any).cat_narrative_financing_sources.findFirst({ where: { name: fund.toString() } });
            if (!fs) await (prisma as any).cat_narrative_financing_sources.create({ data: { name: fund.toString() } });
        } catch (e) { /* ignore */ }
    }

    for (const ben of beneficiaries) {
        try {
            const bt = await (prisma as any).cat_narrative_beneficiary_types.findFirst({ where: { name: ben.toString() } });
            if (!bt) await (prisma as any).cat_narrative_beneficiary_types.create({ data: { name: ben.toString() } });
        } catch (e) { /* ignore */ }
    }

    for (const [key, val] of budgetPrograms.entries()) {
        try {
            const bp = await prisma.budgetProgram.findFirst({ where: { name: val.name } });
            if (!bp) {
                await prisma.budgetProgram.create({
                    data: { name: val.name, code: val.code || 0, type: 'Estatal' }
                });
            }
        } catch (e) { /* ignore */ }
    }

    // ODS
    const odsGoals = [
        "Fin de la pobreza", "Hambre cero", "Salud y bienestar", "Educación de calidad",
        "Igualdad de género", "Agua limpia y saneamiento", "Energía asequible y no contaminante",
        "Trabajo decente y crecimiento económico", "Industria, innovación e infraestructura",
        "Reducción de las desigualdades", "Ciudades y comunidades sostenibles",
        "Producción y consumo responsables", "Acción por el clima", "Vida submarina",
        "Vida de ecosistemas terrestres", "Paz, justicia e instituciones sólidas",
        "Alianzas para lograr los objetivos"
    ];
    let oCode = 1;
    for (const goal of odsGoals) {
        try {
            const odsMatch = await prisma.odsLinkage.findFirst({ where: { name: goal } });
            if (!odsMatch) {
                await prisma.odsLinkage.create({ data: { name: goal, code: oCode } });
            }
            oCode++;
        } catch (e) { /* ignore */ }
    }

    console.log("✅ Catálogos integrados e insertados correctamente desde JSON y Estándares");
}

main().catch(console.error).finally(async () => { await prisma.$disconnect(); });
