import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function verifySum() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
  const sheetName = "FABRICAÇÃO PRELAJE";
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  let oaeTotalPrev = 0;
  const targetOAE = "S03";
  
  // Find Status column index in data rows (based on our discovery: col 3)
  const statusCol = 3;
  const startCol = 5;
  const endCol = 1126;

  for (let r = 5; r < data.length; r++) {
    const row = data[r] || [];
    // We need to track OAE too because it might be null for real row
    // But since Prelaje rows come in pairs: Row 5=Prev, Row 6=Real?
    // Let's assume Row 5 OAE=S03.
    if (r === 5) console.log("Row 5 OAE:", row[1], "Status:", row[3]);
    
    const statusVal = String(row[statusCol] || '').toUpperCase();
    if (statusVal.includes('PREV')) {
       // Check if current or previous OAE was S03
       // Actually let's just sum specific rows we know.
       if (r === 5) {
          for(let i=startCol; i<=endCol; i++) {
             const v = Number(row[i]) || 0;
             oaeTotalPrev += v;
          }
       }
    }
  }
  
  console.log(`Manual Sum for Row 5 (S03 Prev): ${oaeTotalPrev}`);
}

verifySum();
