import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    workbook.SheetNames.forEach(sn => {
        if (sn.toUpperCase().includes("TRANSVERSINA")) {
            console.log(`\nSheet: "${sn}"`);
            const sheet = workbook.Sheets[sn];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            // Let's print rows 0-15 to see exact structure
            for (let i = 0; i <= 15; i++) {
                if (data[i]) {
                    console.log(`Row ${i}:`, JSON.stringify(data[i]));
                }
            }
        }
    });

} catch (e) {
    console.error("Error:", e.message);
}
