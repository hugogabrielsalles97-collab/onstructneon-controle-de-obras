import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:\\Users\\hugo.sales\\Downloads\\2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx";

try {
  const fileContent = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
  const dailyData = {};
  const customRows = [];

  workbook.SheetNames.forEach(sheetName => {
    if (sheetName === 'Planilha1') return;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        if (rows[i] && rows[i].some(c => (c instanceof Date) || (typeof c === 'number' && c > 40000))) {
            headerRowIdx = i;
            break;
        }
    }
    
    if (headerRowIdx === -1) return;
    
    const headers = rows[headerRowIdx];
    const dateHeaders = [];
    headers.forEach((h, colIdx) => {
        if (h instanceof Date) {
            dateHeaders[colIdx] = h.toISOString().split('T')[0];
        } else if (typeof h === 'number' && h > 40000) {
            const d = XLSX.SSF.parse_date_code(h);
            const date = new Date(d.y, d.m - 1, d.d);
            dateHeaders[colIdx] = date.toISOString().split('T')[0];
        } else {
            dateHeaders[colIdx] = null;
        }
    });

    let currentEng = '';
    let currentOae = '';
    let currentApoio = '';

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const val0 = row[0];
        const val1 = row[1];
        const val2 = row[2];
        
        if (val0 !== undefined && val0 !== null && String(val0).trim() !== '') currentEng = String(val0).trim();
        if (val1 !== undefined && val1 !== null && String(val1).trim() !== '') currentOae = String(val1).trim();
        if (val2 !== undefined && val2 !== null && String(val2).trim() !== '') currentApoio = String(val2).trim();

        let rowType = null;
        let isReal = false;
        for (let col = 0; col < Math.min(row.length, 10); col++) {
            const cellVal = String(row[col] || '').toUpperCase();
            if (cellVal.includes('PREV')) { rowType = 'prev'; break; }
            if (cellVal.includes('REAL')) { rowType = 'real'; isReal = true; break; }
        }
        
        if (!rowType) continue;

        let taskId;
        if (!isReal) {
            taskId = `imp_${sheetName}_${i}_${currentOae}`.replace(/\W/g, '_');
            customRows.push({
                id: taskId,
                title: `${sheetName}`,
                description: '',
                discipline: sheetName.trim(),
                location: currentOae,
                support: currentApoio,
                assignee: currentEng,
                level: 'OAE',
                status: 'ToDo',
                progress: 0,
                quantity: 0,
                unit: 'un',
                startDate: '',
                dueDate: '',
                plannedMachinery: [],
                plannedManpower: []
            });
        } else {
            const lastTask = customRows[customRows.length - 1];
            taskId = lastTask ? lastTask.id : `imp_${sheetName}_${i}_${currentOae}`.replace(/\W/g, '_');
        }

        if (!dailyData[taskId]) dailyData[taskId] = {};

        dateHeaders.forEach((dateStr, colIdx) => {
            if (!dateStr) return;
            const val = row[colIdx];
            if (val !== undefined && val !== null && val !== '' && val !== '-') {
                const num = parseFloat(String(val).replace(',', '.'));
                if (!isNaN(num)) {
                    if (!dailyData[taskId][dateStr]) dailyData[taskId][dateStr] = { prev: 0, real: 0 };
                    dailyData[taskId][dateStr][rowType] = num;
                }
            }
        });
    }
  });

  const payload = { dailyData, customRows };
  fs.writeFileSync('public/monitoring_seed.json', JSON.stringify(payload));
  console.log(`Imported ${customRows.length} rows.`);
} catch (e) {
  console.error(e);
}
