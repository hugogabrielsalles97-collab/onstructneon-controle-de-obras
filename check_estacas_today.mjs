import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'ESTACAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const idx = data[4].indexOf(46112);
    if (idx !== -1) {
        let count = 0;
        data.forEach(row => { if (row[idx]) count++; });
        console.log(`ESTACAS rows with data for MAR 31: ${count}`);
    } else {
        console.log("March 31 NOT in ESTACAS dates header row 4.");
    }

} catch (e) {
    console.error("Error:", e.message);
}
