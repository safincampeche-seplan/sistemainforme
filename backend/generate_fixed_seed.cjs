const fs = require('fs');
const path = require('path');
const readline = require('readline');

const inputFile = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/captura_informe.sql';
const outputFile = '/Users/carlosf.caceres/Documents/GitHub/sistemainforme/backend/seed_full_catalogs.sql';

const tables = {
    'cat_narrative_periods': '(id, name, year, deleted_at, created_at, updated_at)',
    'cat_missions': '(id, name, code, narrative_period_id, title_color, theme_color, subtheme_color, deleted_at, created_at, updated_at)',
    'cat_narrative_titles': '(id, name, code, mission_id, deleted_at, created_at, updated_at)',
    'cat_narrative_themes': '(id, name, code, narrative_title_id, deleted_at, created_at, updated_at)',
    'cat_narrative_sub_themes': '(id, name, code, narrative_theme_id, deleted_at, created_at, updated_at)',
    'cat_sectors': '(id, name, acronym, description, created_at, updated_at, deleted_at)',
    'cat_dependencies': '(id, name, acronym, is_secretary, dependency_axis, is_trust, is_deconcentrated, is_decentralized, is_company, mission_id, sector_id, created_at, updated_at)',
    'cat_municipalities': '(id, name, deleted_at, created_at, updated_at)',
    'cat_localities': '(id, name, code, municipality_id, deleted_at, created_at, updated_at)',
    'cat_ppas_types': '(id, name, deleted_at, created_at, updated_at)',
    'cat_profiles': '(id, name, deleted_at, created_at, updated_at)',
    'cat_budget_programs': '(id, name, code, type, deleted_at, created_at, updated_at)',
    'cat_narrative_financing_sources': '(id, name, deleted_at, created_at, updated_at)',
    'cat_narrative_beneficiary_types': '(id, name, deleted_at, created_at, updated_at)'
};

async function processFile() {
    const fileStream = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outStream = fs.createWriteStream(outputFile);
    outStream.write("SET FOREIGN_KEY_CHECKS=0;\n\n");

    for await (const line of rl) {
        let matched = false;
        for (const [table, cols] of Object.entries(tables)) {
            const regex = new RegExp(`INSERT INTO \`${table}\` VALUES`, 'i');
            if (regex.test(line)) {
                const fixedLine = line.replace(regex, `REPLACE INTO \`${table}\` ${cols} VALUES`);
                outStream.write(fixedLine + "\n");
                matched = true;
                break;
            }
        }
    }

    outStream.write("\nSET FOREIGN_KEY_CHECKS=1;\n");
    console.log("✅ seed_full_catalogs.sql generado correctamente con columnas explícitas.");
}

processFile();
