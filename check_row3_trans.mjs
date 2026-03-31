import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const row3 = data[3] || [];
    console.log(`\nROW 3: ${JSON.stringify(row3).slice(0, 500)}`);
} catch (e) {
    console.error("Error:", e.message);
}
