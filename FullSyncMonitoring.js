import XLSX from 'xlsx';
import fs from 'fs';

// Manual .env parsing
const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing config!");
    process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function sbFetch(subpath, options = {}) {
    // subpath: e.g. /rest/v1/monitoring_rows
    const res = await fetch(`${SUPABASE_URL}${subpath}`, {
        ...options,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fetch [${options.method || 'GET'} ${subpath}] Error: ${res.status} ${res.statusText} - ${text}`);
    }
    // Minimal or No Content responses
    if (res.status === 204 || res.status === 201) return null;
    try {
        return await res.json();
    } catch (e) {
        return null;
    }
}

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

function excelDateToISODate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return dateObj.toISOString().split('T')[0];
}

async function fullSync() {
  try {
    console.log("Reading Excel...");
    const workbook = XLSX.readFile(filePath);
    const relevantSheets = [
      "ESTACAS", "BLOCOS", "PILARES", "TRAVESSAS", "PILAR PROVISORIO",
      "FABRICAÇÃO VIGAS", "LANÇAMENTO VIGAS", "FABRICAÇÃO PRELAJE",
      "MONTAGEM PRELAJE", "TRANSVERSINAS", " LAJE", "LAJE ELÁSTICA",
      "LAJE DE APROXIMAÇÃO "
    ];

    const dailyDataByRow = {};

    relevantSheets.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;

      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 4, defval: null });
      if (data.length < 2) return;

      const header = data[0];
      const dateColumns = [];
      header.forEach((val, idx) => {
        if (typeof val === 'number' && val > 40000) {
          dateColumns.push({ index: idx, dateKey: excelDateToISODate(val) });
        }
      });

      let lastResp = '';
      let lastOAE = '';
      let lastApoio = '';

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length < 4) continue;

        let resp = row[0];
        let oae = row[1];
        let apoio = row[2];
        const statusVal = String(row[3] || '').trim().toUpperCase();

        if (resp) lastResp = String(resp).trim();
        if (oae) lastOAE = String(oae).trim();
        if (apoio) lastApoio = String(apoio).trim();

        if (!lastOAE && !lastApoio) continue;
        if (statusVal === 'TOTAL' || statusVal === 'SOMATÓRIO') continue;

        const cleanService = sheetName.trim().replace(/\s+/g, '_');
        const cleanOAE = String(lastOAE).replace(/\s+/g, '_');
        const cleanApoio = String(lastApoio).replace(/\s+/g, '_');
        const rowKey = `${cleanService}_${cleanOAE}_${cleanApoio}`;

        if (!dailyDataByRow[rowKey]) {
          dailyDataByRow[rowKey] = {
             id: rowKey,
             service: sheetName.trim(),
             oae: String(lastOAE),
             apoio: String(lastApoio),
             responsible: String(lastResp),
             daily_data: {}
          };
        }

        const isPrev = statusVal.includes('PREV') || statusVal.includes('P:') || statusVal.includes('PLANEJAD');
        const isReal = statusVal.includes('REAL') || statusVal.includes('R:') || statusVal.includes('REALIZAD');

        if (isPrev || isReal) {
            dateColumns.forEach(dc => {
              const val = row[dc.index];
              if (val !== null && val !== undefined && val !== '-' && val !== '') {
                 const numVal = Number(String(val).replace(',', '.'));
                 if (!isNaN(numVal) && numVal !== 0) {
                     if (!dailyDataByRow[rowKey].daily_data[dc.dateKey]) {
                       dailyDataByRow[rowKey].daily_data[dc.dateKey] = { prev: 0, real: 0 };
                     }
                     if (isPrev) dailyDataByRow[rowKey].daily_data[dc.dateKey].prev = numVal;
                     else dailyDataByRow[rowKey].daily_data[dc.dateKey].real = numVal;
                 }
              }
            });
        }
      }
    });

    const finalRows = Object.values(dailyDataByRow);
    console.log(`Parsed ${finalRows.length} rows.`);

    // 1. DELETE
    console.log("Clearing DB...");
    await sbFetch('/rest/v1/monitoring_rows?id=neq._CONFIG_', { 
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' }
    });
    console.log("DB cleared.");

    // 2. INSERT
    const chunkSize = 50;
    console.log(`Starting upload of ${finalRows.length} rows...`);
    for (let i = 0; i < finalRows.length; i += chunkSize) {
      const chunk = finalRows.slice(i, i + chunkSize);
      try {
          await sbFetch('/rest/v1/monitoring_rows', {
            method: 'POST',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify(chunk)
          });
          process.stdout.write(`(${i + chunk.length})`);
      } catch (err) {
          console.error(`\nBATCH ERROR AT INDEX ${i}:`, err.message);
          throw err;
      }
    }
    console.log("\nUpload Done.");

    // 3. SEED
    const seedResult = {
        rows: finalRows.map(r => ({ id: r.id, service: r.service, oae: r.oae, apoio: r.apoio, responsible: r.responsible })),
        dailyData: finalRows.reduce((acc, r) => { acc[r.id] = r.daily_data; return acc; }, {})
    };
    fs.writeFileSync('public/monitoring_seed.json', JSON.stringify(seedResult, null, 2));
    
  } catch (e) {
    console.error("Fatal:", e);
  }
}

fullSync();
