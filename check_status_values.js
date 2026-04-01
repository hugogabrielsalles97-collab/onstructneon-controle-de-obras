import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function checkStatusValues(sheetName) {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  // Find colMap status first
  let statusCol = -1;
  for(let r=0; r<10; r++) {
    if(data[r]?.some(c => String(c || '').toUpperCase().includes('OAE'))) {
       data[r].forEach((c, idx) => {
         if(String(c || '').toUpperCase().includes('PREV/REAL') || String(c || '').toUpperCase().includes('P / R')) statusCol = idx;
       });
       break;
    }
  }
  
  console.log(`--- Sheet: ${sheetName} | StatusCol: ${statusCol} ---`);
  for (let r = 0; r < 20; r++) {
    const row = data[r] || [];
    if (row[statusCol]) {
      console.log(`Row ${r}: "${row[statusCol]}"`);
    }
  }
}

checkStatusValues("FABRICAÇÃO PRELAJE");
checkStatusValues("ESTACAS");
