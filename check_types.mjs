import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const row4 = data[4] || [];
    console.log(`\nCol 9: val=${row4[9]}, type=${typeof row4[9]}`);
    console.log(`Col 10: val=${row4[10]}, type=${typeof row4[10]}`);
} catch (e) {
    console.error("Error:", e.message);
}
