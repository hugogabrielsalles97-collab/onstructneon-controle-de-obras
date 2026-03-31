import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'ESTACAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nSHEET: ${sn}`);
    for (let i = 0; i <= 6; i++) {
        console.log(`ROW ${i}:`, JSON.stringify(data[i] || []).slice(0, 500));
    }
} catch (e) {
    console.error("Error:", e.message);
}
