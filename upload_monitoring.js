import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Supabase environment variables NOT found!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

function excelDateToISODate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return dateObj.toISOString().split('T')[0];
}

async function upload() {
  try {
    console.log("Reading Excel...");
    const workbook = XLSX.readFile(filePath);
    const relevantSheets = [
      "ESTACAS", "BLOCOS", "PILARES", "TRAVESSAS", "PILAR PROVISORIO",
      "FABRICAÇÃO VIGAS", "LANÇAMENTO VIGAS", "FABRICAÇÃO PRELAJE",
      "MONTAGEM PRELAJE", "TRANSVERSINAS", " LAJE", "LAJE ELÁSTICA",
      "LAJE DE APROXIMAÇÃO "
    ];

    const allRows = [];
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

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length < 4) continue;

        const resp = row[0];
        const oae = row[1];
        const apoio = row[2];
        const pOrR = String(row[3]).trim().toUpperCase();

        if (!oae && !apoio) continue;

        const rowKey = `${sheetName.trim().replace(/\s+/g, '_')}_${String(oae).trim().replace(/\s+/g, '_')}_${String(apoio).trim().replace(/\s+/g, '_')}`;

        if (!dailyDataByRow[rowKey]) {
          dailyDataByRow[rowKey] = {
             id: rowKey,
             service: sheetName.trim(),
             oae: String(oae || '').trim(),
             apoio: String(apoio || '').trim(),
             responsible: String(resp || '').trim(),
             daily_data: {}
          };
        }

        dateColumns.forEach(dc => {
          const val = row[dc.index];
          if (val !== null && val !== undefined && val !== '-') {
             if (!dailyDataByRow[rowKey].daily_data[dc.dateKey]) {
               dailyDataByRow[rowKey].daily_data[dc.dateKey] = { prev: 0, real: 0 };
             }
             if (pOrR === 'PREV.' || pOrR === 'P:' || pOrR === 'PREV') {
               dailyDataByRow[rowKey].daily_data[dc.dateKey].prev = Number(val);
             } else if (pOrR === 'REAL' || pOrR === 'R:' || pOrR === 'REALIZADO') {
               dailyDataByRow[rowKey].daily_data[dc.dateKey].real = Number(val);
             }
          }
        });
      }
    });

    const finalRows = Object.values(dailyDataByRow).map(r => ({
        ...r,
        updated_at: new Date().toISOString()
    }));
    console.log(`Prepared ${finalRows.length} rows. Uploading...`);

    const chunkSize = 50;
    for (let i = 0; i < finalRows.length; i += chunkSize) {
      const chunk = finalRows.slice(i, i + chunkSize);
      const { error } = await supabase.from('monitoring_rows').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error("Error uploading chunk:", error);
      } else {
        console.log(`Uploaded rows ${i} to ${Math.min(i + chunkSize, finalRows.length)}`);
      }
    }

    console.log("Upload completed!");
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

upload();
