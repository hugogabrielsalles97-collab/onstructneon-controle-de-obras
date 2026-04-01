import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function checkHeadersDetailed() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  
  const sheets = ["ESTACAS", "FABRICAÇÃO PRELAJE", "LAJE"];
  sheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    console.log(`\n=== SHEET: ${sheetName} ===`);
    for(let r=3; r<=6; r++) {
      console.log(`Row ${r}: ${JSON.stringify(data[r])}`);
    }
  });
}

checkHeadersDetailed();
