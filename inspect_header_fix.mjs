import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nSHEET: ${sn}`);
    console.log(`ROW 4: ${JSON.stringify(data[4] || [])}`);
    console.log(`ROW 5: ${JSON.stringify(data[5] || [])}`);
    console.log(`ROW 6: ${JSON.stringify(data[6] || [])}`);
} catch (e) {
    console.error("Error:", e.message);
}
