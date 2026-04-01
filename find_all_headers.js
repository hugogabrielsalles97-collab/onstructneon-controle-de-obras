import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx";

function getHeader(sheetName) {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) { return `Not found: ${sheetName}`; }
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });
  for (let i = 0; i < 15; i++) {
    const row = data[i];
    if (row && row.some(c => String(c).includes('OAE'))) {
       return `Sheet: ${sheetName}, Row: ${i}, Content: ${JSON.stringify(row)}`;
    }
  }
  return `Not found header in ${sheetName}`;
}

const sheets = ["ESTACAS", "BLOCOS", "PILARES", "TRAVESSAS", "FABRICAÇÃO PRELAJE", "LAJE", "TRANSVERSINAS"];
sheets.forEach(s => console.log(getHeader(s)));
