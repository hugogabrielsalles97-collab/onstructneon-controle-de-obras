import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function checkFirstRows() {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets["FABRICAÇÃO PRELAJE"];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  for(let r=4; r<=15; r++) {
    console.log(`Row ${r}: OAE="${data[r][1]}" Status="${data[r][3]}"`);
  }
}

checkFirstRows();
