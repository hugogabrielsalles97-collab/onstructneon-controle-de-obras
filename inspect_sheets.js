import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

const targetSheets = [
  "FABRICAÇÃO PRELAJE",
  "FABRICAÇÃO VIGAS",
  "LAJE",
  "LAJE DE APROXIMAÇÃO ",
  "LAJE ELÁSTICA",
  "LANÇAMENTO VIGAS",
  "MONTAGEM PRELAJE"
];

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  
  targetSheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.log(`Sheet not found: "${sheetName}"`);
        return;
    }
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });
    console.log(`--- SHEET: "${sheetName}" ---`);
    for (let i = 0; i < Math.min(data.length, 15); i++) {
        console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }
  });
} catch (e) {
  console.error("Error:", e);
}
