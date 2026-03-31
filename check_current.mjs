import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const row4 = data[4] || [];
    
    // Find index of late March 2026 (approx 46110)
    let targetIdx = -1;
    row4.forEach((val, idx) => {
        if (typeof val === 'number' && val >= 46080 && val <= 46150) {
            targetIdx = idx;
        }
    });
    
    if (targetIdx !== -1) {
        console.log(`Found March/April 2026 at index ${targetIdx}.`);
        // Check Row 5-100 at this index
        let rowsWithNumbers = 0;
        for (let r = 5; r < data.length; r++) {
            const val = data[r][targetIdx];
            if (val !== null && val !== undefined && val !== '' && val !== '-') {
                rowsWithNumbers++;
                if (rowsWithNumbers < 5) console.log(`Row ${r} has value ${val} at index ${targetIdx}`);
            }
        }
        console.log(`Total rows with data for March/April 2026: ${rowsWithNumbers}`);
    } else {
        console.log("March/April 2026 dates not found in Row 4!");
    }

} catch (e) {
    console.error("Error:", e.message);
}
