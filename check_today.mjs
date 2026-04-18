import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Find index of March 31 2026 (46112)
    const targetIdx = 555; // 46112 - 45566 + 9? 
    // Wait, let's look for 46112 in Row 4
    let actualIdx = -1;
    data[4].forEach((v, i) => { if (v === 46112) actualIdx = i; });
    
    if (actualIdx !== -1) {
        console.log(`Found March 31, 2026 at index ${actualIdx}.`);
        let count = 0;
        data.forEach((row, r) => {
            if (row[actualIdx]) {
                count++;
                if (count < 5) console.log(`Row ${r} has value ${row[actualIdx]}`);
            }
        });
        console.log(`Total rows with data for MAR 31: ${count}`);
    } else {
        console.log("March 31, 2026 is NOT in the header row 4 of Transversinas.");
    }

} catch (e) {
    console.error("Error:", e.message);
}
