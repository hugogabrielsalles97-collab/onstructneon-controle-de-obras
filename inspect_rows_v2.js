import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function inspectRows(sheetName) {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });
  console.log(`--- "${sheetName}" ---`);
  for (let i = 4; i < 10; i++) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]));
  }
}

inspectRows("LAJE");
inspectRows("TRANSVERSINAS");
inspectRows("PILARES");
