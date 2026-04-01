import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function testDateDetection() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
  const sheetName = "FABRICAÇÃO PRELAJE";
  const sheet = workbook.Sheets[sheetName];
  const dataFull = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  const headerRowIdx = 4;
  const dateColumns = [];
  const seenIndices = new Set();
  
  for (let i = Math.max(0, headerRowIdx - 1); i <= headerRowIdx + 1; i++) {
      const row = dataFull[i] || [];
      row.forEach((val, idx) => {
          if (val instanceof Date && !seenIndices.has(idx)) {
              dateColumns.push({ index: idx, dateKey: val.toISOString().split('T')[0] });
              seenIndices.add(idx);
          } else if (typeof val === 'number' && val > 40000 && !seenIndices.has(idx)) {
              dateColumns.push({ index: idx, dateKey: "SERIAL_" + val });
              seenIndices.add(idx);
          }
      });
  }
  
  console.log(`Detected ${dateColumns.length} date columns for ${sheetName}`);
  if (dateColumns.length > 0) {
      console.log("First date:", dateColumns[0]);
      console.log("Last date:", dateColumns[dateColumns.length - 1]);
  }
}

testDateDetection();
