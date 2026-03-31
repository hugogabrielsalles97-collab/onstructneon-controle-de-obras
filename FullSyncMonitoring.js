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
    const availableSheetNames = workbook.SheetNames;
    
    const targets = ["ESTACA", "BLOCO", "PILAR", "TRAVESSA", "VIGAS", "PRELAJE", "TRANSVERSINA", "LAJE"];

    const dailyDataByRow = {};

    availableSheetNames.forEach(sheetName => {
      const cleanSn = sheetName.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isRelevant = targets.some(t => cleanSn.includes(t)) && !cleanSn.includes('DATA') && !cleanSn.includes('PIVOT');
      
      if (!isRelevant) return;

      const sheet = workbook.Sheets[sheetName];
      const dataFull = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (dataFull.length < 5) return;

      console.log(`Processing sheet: "${sheetName}" (${dataFull.length} rows)`);

      const dateColumns = [];
      const seenIndices = new Set();
      for (let r = 0; r <= 5; r++) {
          const row = dataFull[r] || [];
          row.forEach((val, idx) => {
              if (typeof val === 'number' && val > 40000 && !seenIndices.has(idx)) {
                  dateColumns.push({ index: idx, dateKey: excelDateToISODate(val) });
                  seenIndices.add(idx);
              }
          });
      }

      let lastResp = '', lastOAE = '', lastApoio = '';

      for (let r = 4; r < dataFull.length; r++) {
        const row = dataFull[r];
        if (!row || row.length < 3) continue;

        if (row[0]) lastResp = String(row[0]).trim();
        if (row[1]) lastOAE = String(row[1]).trim();
        if (row[2]) lastApoio = String(row[2]).trim();

        if (!lastOAE && !lastApoio) continue;

        let isPrev = false;
        let isReal = false;
        let statusColIndex = -1;

        for (let i = 0; i < 15; i++) {
          const val = String(row[i] || '').trim().toUpperCase();
          if (val && (val.includes('PREV') || val.includes('P:') || val.includes('PLANEJAD'))) {
            isPrev = true;
            statusColIndex = i;
            break;
          }
          if (val && (val.includes('REAL') || val.includes('R:') || val.includes('REALIZAD'))) {
            isReal = true;
            statusColIndex = i;
            break;
          }
        }

        if (!isPrev && !isReal && (row[1] || row[2])) {
           isPrev = true;
        }

        if (!isPrev && !isReal) continue;

        // Normalizing service name to singular always for app consistency
        let finalService = sheetName.trim().toUpperCase();
        if (finalService === 'TRANSVERSINAS') finalService = 'TRANSVERSINA';
        if (finalService === 'ESTACAS') finalService = 'ESTACA';
        if (finalService === 'BLOCOS') finalService = 'BLOCO';
        if (finalService === 'PILARES') finalService = 'PILAR';
        if (finalService === 'TRAVESSAS') finalService = 'TRAVESSA';

        const rowKey = `${finalService.replace(/\s+/g, '_')}_${String(lastOAE).trim().replace(/\s+/g, '_').toUpperCase()}_${String(lastApoio).trim().replace(/\s+/g, '_').toUpperCase()}`;

        if (!dailyDataByRow[rowKey]) {
          dailyDataByRow[rowKey] = {
             id: rowKey,
             service: finalService,
             oae: String(lastOAE).trim().toUpperCase(),
             apoio: String(lastApoio).trim().toUpperCase(),
             responsible: String(lastResp).trim(),
             daily_data: {}
          };
        }

        dateColumns.forEach(dc => {
          const val = row[dc.index];
          if (val !== null && val !== undefined && val !== '-' && val !== '') {
             const numVal = Number(String(val).replace(',', '.'));
             if (!isNaN(numVal)) {
                 if (!dailyDataByRow[rowKey].daily_data[dc.dateKey]) {
                   dailyDataByRow[rowKey].daily_data[dc.dateKey] = { prev: 0, real: 0 };
                 }
                 if (isPrev) dailyDataByRow[rowKey].daily_data[dc.dateKey].prev += numVal;
                 else dailyDataByRow[rowKey].daily_data[dc.dateKey].real += numVal;
             }
          }
        });
      }
    });

    const finalRows = Object.values(dailyDataByRow);
    console.log(`Total prepared rows: ${finalRows.length}`);

    console.log("Clearing DB...");
    await sbFetch('/rest/v1/monitoring_rows?id=neq._CONFIG_', { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    console.log("DB cleared.");

    const chunkSize = 50;
    for (let i = 0; i < finalRows.length; i += chunkSize) {
      const chunk = finalRows.slice(i, i + chunkSize);
      await sbFetch('/rest/v1/monitoring_rows', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(chunk) });
      process.stdout.write(`(${i + chunk.length})`);
    }
    console.log("\nUpload Done.");

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
