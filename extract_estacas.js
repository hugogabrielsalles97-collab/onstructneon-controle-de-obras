import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['ESTACAS'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });
  
  // Look at rows 5, 6, 7 (index 0-based)
  // Row 4 was header
  const rows = data.slice(4, 10);
  fs.writeFileSync('sample_rows.json', JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error);
}
