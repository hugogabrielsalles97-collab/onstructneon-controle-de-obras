import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "c:\\Users\\hugo.sales\\OneDrive - EGTC INFRA S.A\\Documentos\\2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx";

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const result = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Find the header row (assume it's the first row with at least 5 strings)
    let headerRow = null;
    let dataRows = [];
    for (const row of json) {
      if (!headerRow) {
        const strCount = row.filter(cell => typeof cell === 'string').length;
        if (strCount >= 4) {
          headerRow = row;
        }
      } else if (row.length > 0) {
        dataRows.push(row);
        if (dataRows.length > 5) break; 
      }
    }
    
    result[sheetName] = { 
      headers: headerRow ? headerRow.slice(0, 15) : [], 
      exampleData: dataRows.map(r => r.slice(0, 15)) 
    };
  }

  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Error reading Excel:", e);
}
