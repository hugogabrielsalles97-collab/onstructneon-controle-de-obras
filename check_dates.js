import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['ESTACAS'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, defval: null });
  const header = data[0];
  const dates = header.filter(h => typeof h === 'number');
  console.log('Date range:', dates[0], 'to', dates[dates.length - 1]);
  console.log('Total days:', dates.length);
} catch (error) {
  console.error(error);
}
