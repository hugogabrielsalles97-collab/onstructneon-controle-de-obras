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

// CBUQ data
// Trechos: "S01 a S08" e "FT - FT03A"
// oae = Trecho, apoio = FT, engenheiro = Igor Maia
const cbuqItems = [
    { oae: 'S01 a S08', apoio: 'FT03A' },
];

function buildRows(service, items) {
    return items.map(item => ({
        id: `${service.replace(/\s+/g, '_')}_${item.oae.replace(/\s+/g, '_')}_${item.apoio}`,
        service: service,
        oae: item.oae,
        apoio: item.apoio,
        responsible: 'Igor Maia',
        daily_data: {},
        updated_at: new Date().toISOString()
    }));
}

async function insertData() {
    try {
        const cbuqRows = buildRows('CBUQ', cbuqItems);

        console.log(`Preparing to insert ${cbuqRows.length} rows...`);
        console.log(`  - CBUQ: ${cbuqRows.length} rows`);

        // Use upsert to avoid duplicates
        await sbFetch('/rest/v1/monitoring_rows', {
            method: 'POST',
            headers: { 'Prefer': 'return=minimal,resolution=merge-duplicates' },
            body: JSON.stringify(cbuqRows)
        });

        console.log('\n✅ All CBUQ rows inserted successfully!');
        console.log('\nInserted rows:');
        cbuqRows.forEach(r => console.log(`  ${r.service} | ${r.oae} | ${r.apoio} | ${r.responsible}`));
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

insertData();
