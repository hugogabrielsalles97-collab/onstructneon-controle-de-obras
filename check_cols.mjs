import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nSHEET: ${sn}`);
    const row4 = data[4] || [];
    console.log("ROW 4 Cols 0-15:");
    for (let i = 0; i < 15; i++) {
        console.log(`Col ${i}: ${row4[i]}`);
    }
    const row8 = data[8] || [];
    console.log("\nROW 8 Cols 0-15:");
    for (let i = 0; i < 15; i++) {
        console.log(`Col ${i}: ${row8[i]}`);
    }

} catch (e) {
    console.error("Error:", e.message);
}
