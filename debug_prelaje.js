import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function debugPrelaje() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
  const sheetName = "FABRICAÇÃO PRELAJE";
  const sheet = workbook.Sheets[sheetName];
  const dataFull = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  let lastOAE = '';
  let rowCountForS03 = 0;
  let totalPrevS03 = 0;
  
  const statusCol = 3; // From our discovery
  const startDataRow = 5;

  for (let r = startDataRow; r < dataFull.length; r++) {
    const row = dataFull[r];
    if (row[1]) lastOAE = String(row[1]).trim();
    
    if (lastOAE === 'S03') {
       rowCountForS03++;
       const statusVal = String(row[statusCol] || '').toUpperCase();
       if (statusVal.includes('PREV')) {
          let rowSum = 0;
          for(let i=5; i<1127; i++) {
             const v = Number(row[i]) || 0;
             rowSum += v;
          }
          totalPrevS03 += rowSum;
          console.log(`Row ${r} Status: PREV, Sum: ${rowSum}`);
       }
    }
  }
  console.log(`Total rows for S03: ${rowCountForS03}`);
  console.log(`Total Prev for S03: ${totalPrevS03}`);
}

debugPrelaje();
