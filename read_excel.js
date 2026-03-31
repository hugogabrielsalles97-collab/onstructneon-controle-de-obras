import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  const analysis = { sheets: [] };

  sheetNames.forEach(name => {
    // skip irrelevant sheets
    if (name.includes('Pivot') || name.includes('Data') || name.includes('Sheet')) {
      // maybe skip, but for now let's see them all
    }

    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Get headers (first few rows)
    const headers = [];
    for (let r = 0; r <= 8; r++) { // read first 8 rows
      let rowData = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({r, c})];
        rowData.push(cell ? cell.v : null);
      }
      headers.push(rowData);
    }

    analysis.sheets.push({
      name,
      rows: headers
    });
  });

  fs.writeFileSync('excel_analysis.json', JSON.stringify(analysis, null, 2));
  console.log('Analysis written to excel_analysis.json');
} catch (error) {
  console.error('Error reading Excel:', error);
}
