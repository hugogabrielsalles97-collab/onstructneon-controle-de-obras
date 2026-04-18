import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nSheet: ${sn}`);
    
    let rowsWithDataFound = 0;
    for (let r = 5; r < data.length; r++) {
        const row = data[r] || [];
        let hasDaily = false;
        // Check columns 9 to 500 (dates)
        for (let c = 9; c < Math.min(row.length, 500); c++) {
            if (row[c] !== null && row[c] !== undefined && row[c] !== '' && row[c] !== '-') {
                hasDaily = true;
                break;
            }
        }
        if (hasDaily) {
            rowsWithDataFound++;
            if (rowsWithDataFound < 5) {
                console.log(`Row ${r} has daily data:`, JSON.stringify(row).slice(0, 500));
            }
        }
    }
    console.log(`Total rows with data in columns 9+: ${rowsWithDataFound}`);

} catch (e) {
    console.error("Error:", e.message);
}
