import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:\\Users\\hugo.sales\\Downloads\\2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx";

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  
  let output = "";

  const sheetName = 'FABRICAÇÃO VIGAS';
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  output += `\n\n=== SHEET: ${sheetName} ===\n`;
  for (let i = 0; i < 20; i++) {
      if (json[i]) {
          const rowStr = json[i].slice(0, 15).map(x => x === null || x === undefined ? ' ' : String(x).trim()).join(" | ");
          output += `Row ${i}: ${rowStr}\n`;
      }
  }

  fs.writeFileSync('excel_headers_vigas.txt', output);
  console.log("Wrote vigas to excel_headers_vigas.txt");

} catch (e) {
  console.error("Error reading Excel:", e);
}
