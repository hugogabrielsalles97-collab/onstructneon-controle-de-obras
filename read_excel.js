import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "c:\\Users\\hugo.sales\\OneDrive - EGTC INFRA S.A\\Documentos\\2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx";

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const result = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    result[sheetName] = json.slice(0, 30);
  }

  fs.writeFileSync("excel_structure.json", JSON.stringify(result, null, 2));
  console.log("Successfully extracted Excel structure to excel_structure.json");
} catch (e) {
  console.error("Error reading Excel:", e);
}
