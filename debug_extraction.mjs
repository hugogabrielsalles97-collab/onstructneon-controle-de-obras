import XLSX from 'xlsx';
import fs from 'fs';

// Manual .env parsing
const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function fullSync() {
  try {
    const workbook = XLSX.readFile('C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx');
    const targets = ["ESTACA", "BLOCO", "PILAR", "TRAVESSA", "VIGAS", "PRELAJE", "TRANSVERSINA", "LAJE"];
    const dailyDataByRow = {};

    workbook.SheetNames.forEach(sheetName => {
      const cleanSn = sheetName.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!targets.some(t => cleanSn.includes(t)) || cleanSn.includes('DATA') || cleanSn.includes('PIVOT')) return;

      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, defval: null });
      if (data.length < 2) return;

      const header = data[0];
      const dateColumns = [];
      header.forEach((val, idx) => {
        if (typeof val === 'number' && val > 40000) {
          dateColumns.push({ index: idx, dateKey: new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0] });
        }
      });

      console.log(`\n--- ${sheetName} --- Found ${dateColumns.length} date columns.`);
      
      let lastResp = '', lastOAE = '', lastApoio = '';

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length < 3) continue;

        if (row[0]) lastResp = String(row[0]).trim();
        if (row[1]) lastOAE = String(row[1]).trim();
        if (row[2]) lastApoio = String(row[2]).trim();

        if (!lastOAE && !lastApoio) continue;

        let isPrev = false, isReal = false;
        for (let i = 0; i < 15; i++) {
          const v = String(row[i] || '').trim().toUpperCase();
          if (v.includes('PREV') || v.includes('P:') || v.includes('PLANEJAD')) { isPrev = true; break; }
          if (v.includes('REAL') || v.includes('R:') || v.includes('REALIZAD')) { isReal = true; break; }
        }

        // Fallback for Transversinas
        if (!isPrev && !isReal && (row[1] || row[2])) isPrev = true;

        if (!isPrev && !isReal) continue;

        const rowKey = `${sheetName.trim().toUpperCase().replace(/\s+/g, '_')}_${String(lastOAE).trim().replace(/\s+/g, '_').toUpperCase()}_${String(lastApoio).trim().replace(/\s+/g, '_').toUpperCase()}`;
        if (!dailyDataByRow[rowKey]) {
          dailyDataByRow[rowKey] = { id: rowKey, service: sheetName.trim().toUpperCase(), oae: String(lastOAE).trim(), apoio: String(lastApoio).trim(), responsible: lastResp, daily_data: {} };
        }

        let valsFound = 0;
        dateColumns.forEach(dc => {
          const val = row[dc.index];
          if (val !== null && val !== undefined && val !== '-' && val !== '') {
             const numVal = Number(String(val).replace(',', '.'));
             if (!isNaN(numVal)) {
                 if (!dailyDataByRow[rowKey].daily_data[dc.dateKey]) dailyDataByRow[rowKey].daily_data[dc.dateKey] = { prev: 0, real: 0 };
                 if (isPrev) dailyDataByRow[rowKey].daily_data[dc.dateKey].prev += numVal;
                 else dailyDataByRow[rowKey].daily_data[dc.dateKey].real += numVal;
                 valsFound++;
             }
          }
        });
        if (valsFound > 0) {
            console.log(`Row ${r}: Set ${isPrev?'PREV':'REAL'} for ${lastOAE} ${lastApoio}: ${valsFound} values.`);
        }
      }
    });

    // UPLOAD BLOCKED FOR DEBUGGING - Just print stats
    const finalRows = Object.values(dailyDataByRow);
    const transRows = finalRows.filter(r => r.service.includes('TRANSVERSINA'));
    console.log(`\nDEBUG: Total Transversina rows prepared: ${transRows.length}`);
    const withData = transRows.filter(r => Object.keys(r.daily_data).length > 0);
    console.log(`DEBUG: Transversina rows with actual daily_data: ${withData.length}`);

  } catch (e) {
    console.error(e);
  }
}

fullSync();
