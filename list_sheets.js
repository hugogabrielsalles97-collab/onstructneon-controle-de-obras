import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:\\Users\\hugo.sales\\Downloads\\2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx";

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  console.log("SHEETS:", JSON.stringify(workbook.SheetNames));
} catch (e) {
  console.error("Error:", e);
}
