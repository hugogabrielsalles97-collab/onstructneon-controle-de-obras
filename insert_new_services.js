import fs from 'fs';

// Manual .env parsing
const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing config!");
    process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function sbFetch(subpath, options = {}) {
    const res = await fetch(`${SUPABASE_URL}${subpath}`, {
        ...options,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
            ...(options.headers || {})
        }
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fetch [${options.method || 'GET'} ${subpath}] Error: ${res.status} ${res.statusText} - ${text}`);
    }
    return null;
}

// SOLO GRAMPEADO data
const soloGrampeadoItems = [
    { oae: 'CS04', apoio: 'FT03A' },
    { oae: 'CS03', apoio: 'FT03A' },
    { oae: 'CD27', apoio: 'FT03A' },
    { oae: 'CD26', apoio: 'FT03A' },
    { oae: 'CS05', apoio: 'FT03B' },
    { oae: 'CS08', apoio: 'FT04' },
    { oae: 'CS35', apoio: 'FT35' },
    { oae: 'CS11', apoio: 'FT06' },
    { oae: 'CS10', apoio: 'FT06' },
    { oae: 'CS09', apoio: 'FT06' },
    { oae: 'CS12', apoio: 'FT09' },
    { oae: 'CS16', apoio: 'FT11' },
    { oae: 'CD32', apoio: 'FT18' },
    { oae: 'CD23', apoio: 'FT26' },
    { oae: 'CD34', apoio: 'FT28A' },
    { oae: 'CD21', apoio: 'FT28B' },
    { oae: 'CD28', apoio: 'FT32' },
    { oae: 'CD20', apoio: 'FT32' },
    { oae: 'CD19', apoio: 'FT19' },
];

// CORTINA ATIRANTADA data
const cortinaAtirantadaItems = [
    { oae: 'CS05', apoio: 'FT03B' },
    { oae: 'CS15', apoio: 'FT10' },
    { oae: 'D23', apoio: 'FT17' },
];

function buildRows(service, items) {
    return items.map(item => ({
        id: `${service.replace(/\s+/g, '_')}_${item.oae}_${item.apoio}`,
        service: service,
        oae: item.oae,
        apoio: item.apoio,
        responsible: 'João Lucas',
        daily_data: {},
        updated_at: new Date().toISOString()
    }));
}

async function insertData() {
    try {
        const soloRows = buildRows('SOLO GRAMPEADO', soloGrampeadoItems);
        const cortinaRows = buildRows('CORTINA ATIRANTADA', cortinaAtirantadaItems);
        const allRows = [...soloRows, ...cortinaRows];

        console.log(`Preparing to insert ${allRows.length} rows...`);
        console.log(`  - SOLO GRAMPEADO: ${soloRows.length} rows`);
        console.log(`  - CORTINA ATIRANTADA: ${cortinaRows.length} rows`);

        // Use upsert to avoid duplicates
        const chunkSize = 50;
        for (let i = 0; i < allRows.length; i += chunkSize) {
            const chunk = allRows.slice(i, i + chunkSize);
            await sbFetch('/rest/v1/monitoring_rows', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal,resolution=merge-duplicates' },
                body: JSON.stringify(chunk)
            });
            console.log(`Uploaded rows ${i + 1} to ${Math.min(i + chunkSize, allRows.length)}`);
        }

        console.log('\n✅ All rows inserted successfully!');
        console.log('\nInserted rows:');
        allRows.forEach(r => console.log(`  ${r.service} | ${r.oae} | ${r.apoio} | ${r.responsible}`));
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

insertData();
