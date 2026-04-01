import * as XLSX from 'xlsx';
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

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-31 OAEs_Monit_Controle- LB4 (nome engenheiro).xlsx';

function excelDateToISODate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return dateObj.toISOString().split('T')[0];
}

async function fullSync() {
  fs.writeFileSync('sync_debug.log', 'Sync Started\n');
  try {
    console.log("Reading Excel...");
    const fileContent = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
    const availableSheetNames = workbook.SheetNames;
    console.log(`Found ${availableSheetNames.length} sheets total.`);
    
    const targets = ["ESTACA", "BLOCO", "PILAR", "PIPLAR", "TRAVESSA", "VIGAS", "PRELAJE", "TRANSVERSINA", "LAJE"];

    const dailyDataByRow = {};

    availableSheetNames.forEach(sheetName => {
      const cleanSn = sheetName.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isRelevant = targets.some(t => cleanSn.includes(t)) && !cleanSn.includes('DATA') && !cleanSn.includes('PIVOT');
      
      if (!isRelevant) return;

      const sheet = workbook.Sheets[sheetName];
      const dataFull = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (dataFull.length < 5) return;

      console.log(`Processing sheet: "${sheetName}" (${dataFull.length} rows)`);

      // Find header row and column mapping
      let headerRowIdx = -1;
      let colMap = { resp: -1, oae: -1, apoio: -1, status: -1 };
      
      for (let r = 0; r < 15; r++) {
        const row = dataFull[r] || [];
        if (row.some(c => String(c || '').toUpperCase().includes('OAE'))) {
          headerRowIdx = r;
          const nextRow = dataFull[r + 1] || [];
          
          const checkCells = (rowArr) => {
            rowArr.forEach((cell, idx) => {
              if (!cell) return;
              const val = String(cell).trim().toUpperCase();
              if (val.includes('RESP') && colMap.resp === -1) colMap.resp = idx;
              if (val.includes('OAE') && !val.includes('APOIO') && colMap.oae === -1) colMap.oae = idx;
              if (val.includes('APOIO') && !val.includes('OAE') && colMap.apoio === -1) colMap.apoio = idx;
              if (val.includes('OAE / APOIO') && colMap.oae === -1) { colMap.oae = idx; colMap.apoio = idx; } 
              if ((val.includes('P / R') || val.includes('PREV') || val.includes('REAL') || val.includes('P/R') || val.includes('PLAN/REAL')) && colMap.status === -1) colMap.status = idx;
            });
          };

          checkCells(row);
          checkCells(nextRow);
          
          if (colMap.resp === -1) colMap.resp = 0; // Default to first col
          if (colMap.oae === -1) colMap.oae = 1;
          if (colMap.status === -1) colMap.status = colMap.apoio === -1 ? 2 : 3; // Best guess

          console.log(`    Header at row ${headerRowIdx}. ColMap: ${JSON.stringify(colMap)}`);
          break;
        }
      }

      if (headerRowIdx === -1) return;

      const dateColumns = [];
      const seenIndices = new Set();
      // Look for dates in the header row and neighbors
      for (let i = Math.max(0, headerRowIdx - 1); i <= headerRowIdx + 1; i++) {
          const row = dataFull[i] || [];
          row.forEach((val, idx) => {
              if (val instanceof Date && !seenIndices.has(idx)) {
                  dateColumns.push({ index: idx, dateKey: val.toISOString().split('T')[0] });
                  seenIndices.add(idx);
              } else if (typeof val === 'number' && val > 40000 && !seenIndices.has(idx)) {
                  // Fallback for non-Date numbers that look like dates
                  dateColumns.push({ index: idx, dateKey: excelDateToISODate(val) });
                  seenIndices.add(idx);
              }
          });
      }

      let lastResp = '', lastOAE = '', lastApoio = '';

      // Skip the header rows themselves. We assume data starts at least at headerRowIdx + 1
      for (let r = headerRowIdx; r < dataFull.length; r++) {
        const row = dataFull[r];
        if (!row || row.length < 2) continue;

        let isPrev = false;
        let isReal = false;
        for (let i = 0; i < 15; i++) {
            const val = String(row[i] || '').trim().toUpperCase();
            if (val && (val.includes('PREV') || val.includes('P:') || val.includes('PLANEJAD'))) {
                isPrev = true; break;
            }
            if (val && (val.includes('REAL') || val.includes('R:') || val.includes('REALIZAD'))) {
                isReal = true; break;
            }
        }

        // If it's a data row (has status), process it
        if (isPrev || isReal) {
            if (colMap.resp !== -1 && row[colMap.resp]) lastResp = String(row[colMap.resp]).trim();
            
            let oaeVal = (colMap.oae !== -1) ? String(row[colMap.oae] || '').trim() : '';
            if (oaeVal) {
                if (oaeVal.includes('/')) {
                    const parts = oaeVal.split('/').map(s => s.trim());
                    lastOAE = parts[0];
                    lastApoio = parts[1] || '';
                } else {
                    lastOAE = oaeVal;
                    if (colMap.apoio >= 0 && colMap.apoio !== colMap.oae && row[colMap.apoio]) {
                        lastApoio = String(row[colMap.apoio]).trim();
                    } else if (colMap.apoio === -1) {
                        lastApoio = '';
                    }
                }
            }
            if (colMap.apoio >= 0 && colMap.apoio !== colMap.oae && row[colMap.apoio]) {
                lastApoio = String(row[colMap.apoio]).trim();
            }

            if (!lastOAE) continue;

            const upperOAE = String(lastOAE).trim().toUpperCase();
            const upperApoio = String(lastApoio).trim().toUpperCase();
            
            // Skip header leftovers or totalizador rows
            if (upperOAE === 'OAE' || upperOAE === 'OAES') continue;
            if (upperApoio === 'ENCONTRO / APOIO' || upperApoio === 'APOIO / ENCONTRO' || upperApoio === 'ENCONTRO' || upperApoio === 'APOIO') {
                if (upperOAE === 'OAE' || !upperOAE) continue;
            }
            if (upperOAE.includes('TOTAL') || upperApoio.includes('TOTAL')) continue;

            const normalizeService = (name) => {
                let s = name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
                if (s === 'ESTACAS') s = 'ESTACA';
                if (s === 'BLOCOS') s = 'BLOCO';
                if (s === 'PILARES') s = 'PILAR';
                if (s === 'TRAVESSAS') s = 'TRAVESSA';
                if (s === 'TRANSVERSINAS') s = 'TRANSVERSINA';
                if (s === 'LAJES') s = 'LAJE';
                if (s === 'PRELAJES') s = 'PRELAJE';
                if (s === 'PIPLAR PROVISORIO' || s === 'PILAR PROVISORIO') s = 'PILAR PROVISORIO';
                if (s === 'VIGAS' && !s.includes('FABRICACAO') && !s.includes('LANCAMENTO')) s = 'VIGA';
                return s;
            };

            const finalService = normalizeService(sheetName);
            
            // User requested to put OAE in Apoio column for FABRICACAO PRELAJE
            if (finalService === 'FABRICACAO PRELAJE') {
                lastApoio = lastOAE;
            }

            const rowKey = `${finalService.replace(/\s+/g, '_')}_${String(lastOAE).trim().replace(/\s+/g, '_').toUpperCase()}_${String(lastApoio).trim().replace(/\s+/g, '_').toUpperCase()}`;

            if (!dailyDataByRow[rowKey]) {
              dailyDataByRow[rowKey] = {
                 id: rowKey, service: finalService,
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
      }
      console.log(`  Added rows from ${sheetName}. Current total: ${Object.keys(dailyDataByRow).length}`);
    });

    const finalRows = Object.values(dailyDataByRow);
    fs.appendFileSync('sync_debug.log', `Final rows: ${finalRows.length}\n`);
    console.log(`Total prepared rows: ${finalRows.length}`);
    if (finalRows.length === 0) {
        console.warn("No rows were prepared! Something might be wrong with colMap or status detection.");
    }

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
