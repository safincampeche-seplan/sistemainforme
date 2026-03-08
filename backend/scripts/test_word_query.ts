import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWordCount() {
    const periodId = 4; // 2025
    console.log("Chequeando para period_id =", periodId);

    const captures = await prisma.narrativeCapture.findMany({
        where: { narrative_period_id: periodId, deleted_at: null, status: 'approved_secont' },
        include: {
            cat_narrative_titles: true,
            cat_narrative_themes: true,
            cat_narrative_sub_themes: true,
            cat_programs: true
        }
    });

    console.log("Hay", captures.length, "narrativas Aprobadas por SECONT (BD)");

    const items = captures.map((cap: any) => {
        let titleName = cap.cat_narrative_titles?.name || "Eje Rector";
        let titleCode = cap.cat_narrative_titles?.code || `${cap.title_id || '1'}`;
        let themeName = cap.cat_narrative_themes?.name || "Tema";
        let themeCode = cap.cat_narrative_themes?.code || `${cap.theme_id || '1.1'}`;
        let subthemeName = cap.cat_narrative_sub_themes?.name || "Subtema";
        let subthemeCode = cap.cat_narrative_sub_themes?.code || `${cap.subtheme_id || '1.1.1'}`;
        let programName = cap.custom_budget_program || cap.cat_programs?.name || "Programa Presupuestario General";

        return {
            title_code: titleCode,
            title_name: titleName,
            theme_code: themeCode,
            theme_name: themeName,
            subtheme_code: subthemeCode,
            subtheme_name: subthemeName,
            program_name: programName,
            content: cap.narrative_breakdown || "Sin contenido.",
            highlighted: cap.highlighted || ""
        };
    });

    console.log("Mapeadas", items.length, "para enviar al WORD");

    // Sort
    items.sort((a: any, b: any) => {
        const cmpTitle = String(a.title_code).localeCompare(String(b.title_code), undefined, { numeric: true });
        if (cmpTitle !== 0) return cmpTitle;
        const cmpTheme = String(a.theme_code).localeCompare(String(b.theme_code), undefined, { numeric: true });
        if (cmpTheme !== 0) return cmpTheme;
        const cmpSubtheme = String(a.subtheme_code).localeCompare(String(b.subtheme_code), undefined, { numeric: true });
        if (cmpSubtheme !== 0) return cmpSubtheme;
        return String(a.program_name).localeCompare(String(b.program_name));
    });

    console.log("Despues del SORT:", items.length);

}
checkWordCount();
