import ExcelJS from 'exceljs';
import path from 'path';

async function analyze() {
    const filePath = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme/cat_dependencias (17.3.26).xlsx';
    console.log(`Analyzing: ${filePath}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    console.log(`\nSheet Name: ${worksheet.name}`);
    console.log(`Total Rows: ${worksheet.rowCount}`);
    console.log(`Total Columns: ${worksheet.columnCount}`);

    console.log("\n--- Headers ---");
    const headers = worksheet.getRow(1).values as any[];
    console.log(headers.filter(Boolean));

    console.log("\n--- Sample Data (First 3 Rows) ---");
    for (let i = 2; i <= Math.min(4, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i).values as any[];
        console.log(`Row ${i}:`, row.filter(Boolean));
    }
}

analyze().catch(console.error);
