import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:\\Users\\hugo.sales\\Downloads\\2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx";

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  
  let output = "";

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'Planilha1') continue;
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    output += `\n\n=== SHEET: ${sheetName} ===\n`;
    for (let i = 0; i < 5; i++) {
        if (json[i]) {
            // print first 8 items of the row, replacing undefined/null with empty strings
            const rowStr = json[i].slice(0, 10).map(x => x === null || x === undefined ? ' ' : x).join(" | ");
            output += `Row ${i}: ${rowStr}\n`;
        }
    }
  }

  fs.writeFileSync('excel_headers.txt', output);
  console.log("Wrote headers to excel_headers.txt");

} catch (e) {
  console.error("Error reading Excel:", e);
}
