import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- ${sn} ---`);
    for (let i = 4; i <= 20; i++) {
        const row = data[i] || [];
        // Only print Row number and first 10 cols + any non-null col index > 9
        let colsToPrint = row.slice(0, 10).map(c => c === null ? "null" : JSON.stringify(c));
        let found = [];
        row.forEach((c, idx) => { if (idx >= 10 && c !== null && c !== undefined && c !== '') found.push(`${idx}:${c}`); });
        console.log(`Row ${i}: [${colsToPrint.join(', ')}] ... Found: ${found.join(', ')}`);
    }

} catch (e) {
    console.error("Error:", e.message);
}
