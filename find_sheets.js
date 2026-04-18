import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  const result = [];

  sheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet['!ref']) return;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Find header
    let headerRow = -1;
    for (let r = 0; r < Math.min(range.e.r, 500); r++) {
      let row = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({r, c})];
        row.push(cell ? String(cell.v).trim().toUpperCase() : '');
      }
      if (row.includes('OAE') && row.includes('ENGENHEIRO RESPONSÁVEL')) {
        headerRow = r;
        break;
      }
    }

    if (headerRow !== -1) {
       result.push({ name, headerRow });
    }
  });

  fs.writeFileSync('relevant_sheets.json', JSON.stringify(result, null, 2));
  console.log('Result written to relevant_sheets.json');
} catch (error) {
  console.error(error);
}
