import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkValidation() {
    const periodId = 4; // 2025

    // Traemos datos como index.ts
    const captures = await prisma.narrativeCapture.findMany({
        where: { narrative_period_id: periodId, deleted_at: null, status: 'approved_secont' },
        include: {
            cat_narrative_titles: true,
            cat_narrative_themes: true,
            cat_narrative_sub_themes: true,
            budget_program: true
        }
    });

    const items = captures.map((cap: any) => {
        let titleName = cap.cat_narrative_titles?.name || "Eje Rector";
        let titleCode = cap.cat_narrative_titles?.code || `${cap.title_id || '1'}`;
        let themeName = cap.cat_narrative_themes?.name || "Tema";
        let themeCode = cap.cat_narrative_themes?.code || `${cap.theme_id || '1.1'}`;
        let subthemeName = cap.cat_narrative_sub_themes?.name || "Subtema";
        let subthemeCode = cap.cat_narrative_sub_themes?.code || `${cap.subtheme_id || '1.1.1'}`;
        let programName = cap.custom_budget_program || cap.budget_program?.name || "Programa Presupuestario General";

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

    const exportData = {
        mission_name: "INFORME DE GOBIERNO CONSOLIDADO 2025",
        title_color: "1E1B4B",
        theme_color: "3730A3",
        subtheme_color: "4F46E5",
        items: items
    };

    try {
        console.log("Enviando " + items.length + " items a Python...");
        const pythonRes = await axios.post('http://localhost:8000/export/word', exportData, {
            responseType: 'arraybuffer'
        });
        console.log("Exitoso. Size:", Buffer.from(pythonRes.data).length);
    } catch (error: any) {
        console.error("Fallo 422 en FastAPI.");
        if (error.response && error.response.data) {
            console.error("Detalle de Validación:", Buffer.from(error.response.data).toString('utf-8'));
        } else {
            console.error(error.message);
        }
    }
}
checkValidation();
