import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nSheet: ${sn}`);
    
    data.forEach((row, r) => {
        if (r < 50) {
            const hasS0 = JSON.stringify(row).includes("S0");
            if (hasS0) {
                console.log(`Row ${r}: ${JSON.stringify(row).slice(0, 500)}`);
            }
        }
    });

} catch (e) {
    console.error("Error:", e.message);
}
