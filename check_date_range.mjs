import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sn = 'TRANSVERSINAS';
    const sheet = workbook.Sheets[sn];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const row4 = data[4] || [];
    console.log(`\nSheet: ${sn}`);
    console.log(`Total columns: ${row4.length}`);
    
    // Find first and last date columns
    let firstDate = -1, lastDate = -1;
    row4.forEach((val, idx) => {
        if (typeof val === 'number' && val > 40000) {
            if (firstDate === -1) firstDate = idx;
            lastDate = idx;
        }
    });
    
    const excelDateToISODate = (serial) => {
        const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
        return dateObj.toISOString().split('T')[0];
    };

    if (firstDate !== -1) {
        console.log(`First date at col ${firstDate}: ${row4[firstDate]} -> ${excelDateToISODate(row4[firstDate])}`);
        console.log(`Last date at col ${lastDate}: ${row4[lastDate]} -> ${excelDateToISODate(row4[lastDate])}`);
    } else {
        console.log("No dates found in Row 4!");
    }

} catch (e) {
    console.error("Error:", e.message);
}
