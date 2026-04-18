import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function inspect(sheetName) {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) { console.log(`Not found: ${sheetName}`); return; }
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });
  console.log(`--- Header for "${sheetName}" ---`);
  // Try to find the header row (has 'OAE' or 'OAEs')
  for (let i = 0; i < 10; i++) {
    const row = data[i];
    if (row && row.some(c => String(c).includes('OAE'))) {
       console.log(`Row ${i}:`, JSON.stringify(row));
    }
  }
}

inspect("FABRICAÇÃO PRELAJE");
inspect("ESTACAS");
inspect("LAJE");
inspect("TRANSVERSINAS");
