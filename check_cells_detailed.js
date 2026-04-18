import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function checkCellsDetailed(sheetName, rowIdx) {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const row = data[rowIdx] || [];
  console.log(`--- ${sheetName} Row ${rowIdx} ---`);
  row.forEach((c, idx) => {
    if (c) console.log(`Col ${idx}: "${c}" (${typeof c})`);
  });
}

checkCellsDetailed("ESTACAS", 3);
checkCellsDetailed("ESTACAS", 4);
checkCellsDetailed("FABRICAÇÃO PRELAJE", 4);
