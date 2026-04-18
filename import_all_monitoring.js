import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx';

function excelDateToISODate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utcdays = Math.floor(serial - 25569);
  const utcmsecs = utcdays * 86400 * 1000;
  const date = new Date(utcmsecs);
  // Add 1 day if necessary or adjust for timezone? Excel 1900 date bug handles serial 60 as Feb 29 (which wasn't a leap year)
  // But usually serial-25569 works for post-1900 dates.
  // Actually, serial 45474 -> July 1, 2024
  // Let's use a simpler way:
  const d = new Date((serial - (25567 + 2)) * 86400 * 1000); // 25567 is 1970-01-01, +2 for Excel bug and 0-index
  // Wait, let's verify: 45474 -> July 1, 2024
  // (45474 - 25569) * 86400 * 1000 = 1720137600000 -> July 5, 2024? No.
  // Actually XLSX.SSF handles this better if needed, but let's just use:
  const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return dateObj.toISOString().split('T')[0];
}

try {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  const monitoringRows = [];
  const dailyData = {};

  const relevantSheets = [
    "ESTACAS", "BLOCOS", "PILARES", "TRAVESSAS", "PILAR PROVISORIO",
    "FABRICAÇÃO VIGAS", "LANÇAMENTO VIGAS", "FABRICAÇÃO PRELAJE",
    "MONTAGEM PRELAJE", "TRANSVERSINAS", " LAJE", "LAJE ELÁSTICA",
    "LAJE DE APROXIMAÇÃO "
  ];

  relevantSheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, defval: null });
    if (data.length < 2) return;

    const header = data[0];
    const dateColumns = [];
    header.forEach((val, idx) => {
      if (typeof val === 'number' && val > 40000) { // Likely a date
        dateColumns.push({ index: idx, dateKey: excelDateToISODate(val) });
      }
    });

    // Rows start from index 1.
    // Each record is 2 rows: some have "PREV." in col 3, some "REAL" in col 3.
    // We need to pair them.
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length < 4) continue;

      const resp = row[0];
      const oae = row[1];
      const apoio = row[2];
      const pOrR = String(row[3]).trim().toUpperCase();

      if (!oae && !apoio) continue; // Skip totals or empty rows

      // Create a unique key for the row (service + oae + apoio + resp)
      const rowKey = `${sheetName}_${oae}_${apoio}_${resp}`.replace(/\s+/g, '_');

      const normalizeService = (name) => {
        let s = name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
        if (s === 'ESTACAS') s = 'ESTACA';
        if (s === 'BLOCOS') s = 'BLOCO';
        if (s === 'PILARES') s = 'PILAR';
        if (s === 'TRAVESSAS') s = 'TRAVESSA';
        if (s === 'TRANSVERSINAS') s = 'TRANSVERSINA';
        if (s.includes('LAJE') && !s.includes('PRELAJE')) s = 'LAJE';
        if (s === 'VIGAS') s = 'VIGA';
        return s;
      };

      const finalService = normalizeService(sheetName);

      if (!dailyData[rowKey]) {
        dailyData[rowKey] = {};
        monitoringRows.push({
          id: rowKey,
          service: finalService,
          oae: String(oae || '').trim(),
          apoio: String(apoio || '').trim(),
          responsible: String(resp || '').trim()
        });
      }

      dateColumns.forEach(dc => {
        const val = row[dc.index];
        if (val !== null && val !== undefined) {
           if (!dailyData[rowKey][dc.dateKey]) dailyData[rowKey][dc.dateKey] = { prev: 0, real: 0 };
           if (pOrR === 'PREV.' || pOrR === 'P:' || pOrR === 'PREV') {
             dailyData[rowKey][dc.dateKey].prev = Number(val);
           } else if (pOrR === 'REAL' || pOrR === 'R:' || pOrR === 'REALIZADO') {
             dailyData[rowKey][dc.dateKey].real = Number(val);
           }
        }
      });
    }
  });

  const finalResult = {
    rows: monitoringRows,
    dailyData: dailyData
  };

  fs.writeFileSync('public/monitoring_seed.json', JSON.stringify(finalResult, null, 2));
  console.log(`Imported ${monitoringRows.length} rows from Excel.`);
} catch (error) {
  console.error(error);
}
