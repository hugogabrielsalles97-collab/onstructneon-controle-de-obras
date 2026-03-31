const XLSX = require('xlsx');

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    console.log("Sheets:", workbook.SheetNames);
    
    // Check one sheet specifically
    const sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes("TRANSVERSINA"));
    if (sheetName) {
        console.log(`\nInspecting sheet: "${sheetName}"`);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log("First 10 rows:");
        data.slice(0, 10).forEach((row, i) => {
            console.log(`Row ${i}:`, row);
        });
    } else {
        console.log("TRANSVERSINAS sheet not found!");
    }
} catch (e) {
    console.error("Error:", e.message);
}
