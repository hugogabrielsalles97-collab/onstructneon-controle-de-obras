import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function testParse() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheets = ["ESTACAS", "BLOCOS", "FABRICAÇÃO PRELAJE", "LAJE", "TRANSVERSINAS", "PILAR PROVISORIO"];

  sheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.log(`! Not found: ${sheetName}`); return; }
    const dataFull = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    let headerRowIdx = -1;
    let colMap = { resp: 0, oae: 1, apoio: 2, status: -1 };
    
    for (let r = 0; r < 15; r++) {
      const row = dataFull[r] || [];
      if (row.some(c => String(c || '').toUpperCase().includes('OAE'))) {
        headerRowIdx = r;
        row.forEach((cell, idx) => {
          const val = String(cell || '').trim().toUpperCase();
          if (val.includes('RESP')) colMap.resp = idx;
          if (val.includes('OAE') && !val.includes('APOIO')) colMap.oae = idx;
          if (val.includes('APOIO') && !val.includes('OAE')) colMap.apoio = idx;
          if (val.includes('OAE / APOIO')) { colMap.oae = idx; colMap.apoio = -idx; } 
          if (val.includes('P / R') || val.includes('PREV/REAL') || (val === 'P/R')) colMap.status = idx;
        });
        break;
      }
    }
    
    console.log(`Sheet: ${sheetName} | HeaderIdx: ${headerRowIdx} | ColMap:`, JSON.stringify(colMap));
    
    if (headerRowIdx !== -1) {
       for (let r = headerRowIdx + 1; r < headerRowIdx + 5; r++) {
          const row = dataFull[r];
          if (!row) continue;
          let isStatusRow = false;
          let statusVal = '';
          if (colMap.status !== -1) {
            statusVal = String(row[colMap.status] || '').trim().toUpperCase();
            if (statusVal.includes('PREV') || statusVal.includes('REAL')) isStatusRow = true;
          }
          if (isStatusRow) {
             const oaeVal = row[colMap.oae];
             console.log(`  Row ${r}: Resp=${row[colMap.resp]}, OAE=${oaeVal}, Status=${statusVal}`);
          }
       }
    }
  });
}

testParse();
