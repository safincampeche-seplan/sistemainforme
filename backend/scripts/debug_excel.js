import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function debugExcel() {
    const filePath = path.join(__dirname, '../../cat_dependencias (17.3.26).xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    console.log(`Buscando posibles razones por las que 906 filas fueron ignoradas...`);
    let skippedCounter = 0;
    // Rows 2 to end
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i).values;
        if (!row || row.length === 0)
            continue;
        const idVal = row[1];
        if (!idVal || isNaN(Number(idVal.toString().trim() !== '' ? idVal : NaN))) {
            if (skippedCounter < 20) {
                console.log(`Fila Omitida ${i}: ID='${idVal}' (type: ${typeof idVal}) | Name=${row[2]} | row=${JSON.stringify(row)}`);
            }
            skippedCounter++;
        }
    }
    console.log(`Total de filas omitidas por no tener ID numérico en la columna 1: ${skippedCounter}`);
}
debugExcel().catch(console.error);
//# sourceMappingURL=debug_excel.js.map