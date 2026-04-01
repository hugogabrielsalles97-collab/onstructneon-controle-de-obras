import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function checkOne() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheetName = "ESTACAS";
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  console.log(`Checking "${sheetName}"`);
  for (let r = 0; r < 10; r++) {
    const row = data[r] || [];
    const match = row.some(c => String(c || '').toUpperCase().includes('OAE'));
    console.log(`Row ${r} match: ${match} | Content: ${JSON.stringify(row)}`);
  }
}

checkOne();
