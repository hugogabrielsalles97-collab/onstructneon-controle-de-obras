import XLSX from 'xlsx';

const filePath = 'C:/Users/hugo.sales/Downloads/2026-03-30 OAEs_Monit_Controle- LB4 (nomes engenheiros).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    console.log("ALL SHEETS:", workbook.SheetNames);
    
    workbook.SheetNames.forEach(sn => {
        const cleanSn = sn.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanSn.includes("TRANSVERSINA")) {
            console.log(`\nMatch found: "${sn}"`);
            const sheet = workbook.Sheets[sn];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            console.log("Rows 0-5:");
            data.slice(0, 6).forEach((row, i) => {
                console.log(`Row ${i}:`, row);
            });
        }
    });
} catch (e) {
    console.error("Error:", e.message);
}
