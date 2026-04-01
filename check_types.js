import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function checkCellTypes() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets["FABRICAÇÃO PRELAJE"];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const row = data[5] || [];
  console.log("Row 5 Cell types:");
  [5, 10, 20, 50, 100, 500, 1000].forEach(i => {
    console.log(`Col ${i}: val="${row[i]}" type=${typeof row[i]}`);
  });
}

checkCellTypes();
