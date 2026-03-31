import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:\\Users\\hugo.sales\\Downloads\\2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx";

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
  
  let newDailyData = {};
  let newCustomRows = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'Planilha1') continue;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        if (rows[i] && typeof rows[i][0] === 'string' && rows[i][0].toLowerCase().includes('engenheiro')) {
            headerRowIdx = i;
            break;
        }
    }
    
    if (headerRowIdx === -1) continue;
    
    const headers = rows[headerRowIdx]; 
    
    const dateColStartIndex = headers.findIndex(h => h instanceof Date || typeof h === 'number' && h > 40000);
    if (dateColStartIndex === -1) continue;

    const headerDates = [];
    for (let c = dateColStartIndex; c < headers.length; c++) {
        const h = headers[c];
        if (h instanceof Date) {
            headerDates[c] = h.toISOString().split('T')[0];
        } else if (typeof h === 'number' && h > 40000) {
            const date = new Date(Math.round((h - 25569) * 86400 * 1000));
            headerDates[c] = date.toISOString().split('T')[0];
        } else {
            headerDates[c] = null;
        }
    }
    
    let currentEng = '';
    let currentOae = '';
    let currentApoio = '';
    
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        
        const val0 = row[0];
        const val1 = row[1];
        const val2 = row[2];
        
        if (val0 !== null && val0 !== undefined && String(val0).trim().length > 0) currentEng = String(val0).trim();
        if (val1 !== null && val1 !== undefined && String(val1).trim().length > 0) currentOae = String(val1).trim();
        if (val2 !== null && val2 !== undefined && String(val2).trim().length > 0) currentApoio = String(val2).trim();
        
        let porR = null;
        let typeInfo = '';
        
        // Find PREV or REAL
        for (let c = 3; c < dateColStartIndex && c < 10; c++) {
             const cellText = String(row[c] || '').toUpperCase();
             if (cellText.includes('PREV')) {
                 porR = 'prev';
             } else if (cellText.includes('REAL')) {
                 porR = 'real';
             }
             
             if (porR) {
                 const hText = String(headers[c] || '').toUpperCase();
                 if (hText.includes('PROTENDIDA')) {
                     typeInfo = hText.includes('Ñ') ? 'Não Protendida' : 'Protendida';
                 }
                 break;
             }
        }
        
        if (!porR) continue;

        const taskId = `imported_${sheetName}_${currentOae}_${currentApoio}_${typeInfo}`.replace(/\s+/g, '_');
        
        if (!newCustomRows.find(tr => tr.id === taskId)) {
            newCustomRows.push({
                id: taskId,
                title: `${sheetName}`, // just leave discipline name
                description: '',
                discipline: sheetName,
                location: currentOae,
                support: currentApoio,
                assignee: currentEng,
                level: 'OAE',
                status: 'To Do',
                progress: 0,
                quantity: 0,
                unit: 'un',
                startDate: new Date().toISOString().split('T')[0],
                dueDate: new Date().toISOString().split('T')[0],
                plannedMachinery: [],
                plannedManpower: []
            });
        }
        
        if (!newDailyData[taskId]) {
            newDailyData[taskId] = { type: typeInfo };
        } else if (typeInfo) {
            newDailyData[taskId].type = typeInfo;
        }
        
        for (let c = dateColStartIndex; c < row.length; c++) {
            const dateStr = headerDates[c];
            if (!dateStr) continue;
            
            const rawVal = row[c];
            if (rawVal === null || rawVal === undefined || rawVal === '' || rawVal === '-') continue;

            const val = parseFloat(String(rawVal).replace(',', '.'));
            if (!isNaN(val)) {
                 if (!newDailyData[taskId][dateStr]) newDailyData[taskId][dateStr] = { prev: 0, real: 0 };
                 newDailyData[taskId][dateStr][porR] += val; // sum in case of dual inputs on same row index? usually isolated
            }
        }
    }
  }
  
  const payload = {
      dailyData: newDailyData,
      customRows: newCustomRows
  };

  fs.writeFileSync('src_default_monitoring_data.json', JSON.stringify(payload));
  console.log("SUCCESS. Wrote " + newCustomRows.length + " rows.");

} catch (e) {
  console.error("Error reading Excel:", e);
}
