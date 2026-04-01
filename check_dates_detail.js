import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function checkDates(sheetName) {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`--- ${sheetName} ---`);
  for (let r = 3; r <= 5; r++) {
    const row = data[r] || [];
    console.log(`Row ${r} Col 5: ${row[5]} (${typeof row[5]})`);
    console.log(`Row ${r} Col 10: ${row[10]} (${typeof row[10]})`);
  }
}

checkDates("ESTACAS");
checkDates("FABRICAÇÃO PRELAJE");
