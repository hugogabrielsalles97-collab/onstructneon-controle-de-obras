/**
 * Insere/atualiza linhas de SOLO GRAMPEADO (FT = NA, Eng. João Lucas).
 * Uso: node insert_solo_grampeado_na.js  (requer .env com VITE_SUPABASE_*)
 *
 * Equivalente à migração: supabase/migrations/20260414120000_solo_grampeado_na_rows.sql
 */
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env');
    process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function sbFetch(subpath, options = {}) {
    const res = await fetch(`${SUPABASE_URL}${subpath}`, {
        ...options,
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal,resolution=merge-duplicates',
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`[${options.method || 'GET'} ${subpath}] ${res.status} - ${text}`);
    }
    return null;
}

/** Mesma convenção da migração SQL: id usa oae com espaços trocados por _ */
function buildId(oae, apoio) {
    const safeOae = oae.replace(/\s+/g, '_');
    return `SOLO_GRAMPEADO_${safeOae}_${apoio}`;
}

const items = [
    { oae: 'CS09', apoio: 'NA' },
    { oae: 'PRAÇA26', apoio: 'NA' },
    { oae: 'CS07XP', apoio: 'NA' },
    { oae: 'CS24', apoio: 'NA' },
    { oae: 'CD26', apoio: 'NA' },
    { oae: 'CS21-R1', apoio: 'NA' },
    { oae: 'CS03', apoio: 'NA' },
    { oae: 'CD34', apoio: 'NA' },
    { oae: 'PRACA27', apoio: 'NA' },
    { oae: 'TD27', apoio: 'NA' },
    { oae: 'D20 P3', apoio: 'NA' },
    { oae: 'D20 P5', apoio: 'NA' },
    { oae: 'D21 P3', apoio: 'NA' },
    { oae: 'D21 P4', apoio: 'NA' },
    { oae: 'CD29', apoio: 'NA' },
    { oae: 'CS10XP', apoio: 'NA' },
    { oae: 'D15', apoio: 'NA' },
    { oae: 'D18', apoio: 'NA' },
    { oae: 'D19', apoio: 'NA' },
    { oae: 'D22', apoio: 'NA' },
    { oae: 'S01', apoio: 'NA' },
    { oae: 'TD25', apoio: 'NA' },
    { oae: 'TS02', apoio: 'NA' },
    { oae: 'TS03', apoio: 'NA' },
    { oae: 'TS05', apoio: 'NA' },
    { oae: 'TS11', apoio: 'NA' },
];

const rows = items.map((item) => ({
    id: buildId(item.oae, item.apoio),
    service: 'SOLO GRAMPEADO',
    oae: item.oae,
    apoio: item.apoio,
    responsible: 'João Lucas',
    daily_data: {},
    updated_at: new Date().toISOString(),
}));

async function main() {
    console.log(`Upsert ${rows.length} linhas SOLO GRAMPEADO (FT=NA)...`);
    await sbFetch('/rest/v1/monitoring_rows', {
        method: 'POST',
        body: JSON.stringify(rows),
    });
    rows.forEach((r) => console.log(`  OK ${r.id}`));
    console.log('\nConcluído.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
