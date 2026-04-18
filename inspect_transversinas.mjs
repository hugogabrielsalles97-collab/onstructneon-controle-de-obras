import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    // Print sheet names explicitly
    workbook.SheetNames.forEach(sn => {
        if (sn.toUpperCase().includes("TRANSVERSINA")) {
            console.log(`\nSheet found: "${sn}"`);
            const sheet = workbook.Sheets[sn];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            console.log(`Row count: ${data.length}`);
            console.log("Rows 0-10:");
            data.slice(0, 11).forEach((row, i) => {
                console.log(`Row ${i}:`, row);
            });
        }
    });

} catch (e) {
    console.error("Error:", e.message);
}
