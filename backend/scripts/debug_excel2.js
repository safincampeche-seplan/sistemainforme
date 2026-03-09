import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function run() {
    const filePath = path.join(__dirname, '../../cat_dependencias (17.3.26).xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.worksheets[0];
    console.log(`Inspeccionando las filas 100 a la 120 para entender la estructura de las omitidas:`);
    for (let i = 100; i <= 120; i++) {
        const row = ws.getRow(i).values;
        console.log(`Fila ${i}: Col1(ID)='${row[1]}', Col2(Nombre)='${row[2]}', Col3='${row[3]}'`);
    }
}
run().catch(console.error);
//# sourceMappingURL=debug_excel2.js.map