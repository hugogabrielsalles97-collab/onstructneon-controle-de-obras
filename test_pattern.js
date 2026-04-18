import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['ESTACAS'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, defval: null });
  
  // Take more rows to see the pattern clearly
  const sample = data.slice(1, 10);
  fs.writeFileSync('sample_pattern.json', JSON.stringify(sample.map(r => r.slice(0, 5)), null, 2));
} catch (error) {
  console.error(error);
}
