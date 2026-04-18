import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['ESTACAS'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, defval: null });
  
  // Header row is index 0 of data now because of range: 4
  const header = data[0];
  const firstRecord = data.slice(1, 4); // Take 3 rows after header
  
  fs.writeFileSync('record_test.json', JSON.stringify({ header: header.slice(0, 10), rows: firstRecord.map(r => r.slice(0, 15)) }, null, 2));
} catch (error) {
  console.error(error);
}
