import fs from 'fs';

const seed = JSON.parse(fs.readFileSync('public/monitoring_seed.json', 'utf8'));
const rows = seed.rows;
const dailyDataMap = seed.dailyData;

let sql = "DELETE FROM public.monitoring_rows WHERE id != '_CONFIG_';\n";
sql += "INSERT INTO public.monitoring_rows (id, service, oae, apoio, responsible, daily_data) VALUES\n";

const values = rows.map(r => {
    const dailyData = JSON.stringify(dailyDataMap[r.id] || {});
    return `('${r.id}', '${r.service}', '${r.oae}', '${r.apoio}', '${r.responsible || ''}', '${dailyData}')`;
});

// SQL INSERT limit is usually high, but let's do chunks of 200 rows
const chunks = [];
for (let i = 0; i < values.length; i += 200) {
    chunks.push(`INSERT INTO public.monitoring_rows (id, service, oae, apoio, responsible, daily_data) VALUES\n` + values.slice(i, i + 200).join(',\n') + ';');
}

fs.writeFileSync('restore_data.sql', "DELETE FROM public.monitoring_rows WHERE id != '_CONFIG_';\n" + chunks.join('\n\n'));
console.log("SQL Restore script generated!");
