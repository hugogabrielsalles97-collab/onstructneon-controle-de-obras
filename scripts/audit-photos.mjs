/**
 * Auditoria das referências de foto. Só lê — não altera nada.
 *
 *   node --env-file=.env scripts/audit-photos.mjs
 *
 * Percorre TODAS as tabelas que têm coluna `photos` e cruza com o conteúdo do
 * bucket, mostrando o que aponta para onde e o que sobrou sem dono.
 */

import { createClient } from '@supabase/supabase-js';
import { PHOTO_TABLES, BUCKET } from './photo-tables.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const PHOTO_BASE_URL = process.env.VITE_PHOTO_BASE_URL.trim().replace(/\/+$/, '');
const ANON = process.env.VITE_SUPABASE_ANON_KEY.trim();

const SUPA_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const referencedKeys = new Set();
const totals = { r2: 0, supabase: 0, base64: 0, outro: 0 };

for (const table of PHOTO_TABLES) {
    const counts = { r2: 0, supabase: 0, base64: 0, outro: 0 };
    let rows = 0;
    let offset = 0;

    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('id, photos')
            .order('id', { ascending: true })
            .range(offset, offset + 199);

        if (error) {
            console.log(`${table}: ERRO — ${error.message}`);
            break;
        }
        if (!data || data.length === 0) break;

        for (const row of data) {
            rows++;
            if (!Array.isArray(row.photos)) continue;

            for (const p of row.photos) {
                if (typeof p !== 'string') { counts.outro++; continue; }

                if (p.startsWith(PHOTO_BASE_URL + '/')) {
                    counts.r2++;
                    referencedKeys.add(decodeURIComponent(p.slice(PHOTO_BASE_URL.length + 1).split('?')[0]));
                } else if (p.startsWith(SUPA_PREFIX)) {
                    counts.supabase++;
                    referencedKeys.add(decodeURIComponent(p.slice(SUPA_PREFIX.length).split('?')[0]));
                } else if (p.startsWith('data:image')) {
                    counts.base64++;
                } else {
                    counts.outro++;
                }
            }
        }

        offset += 200;
    }

    for (const k of Object.keys(counts)) totals[k] += counts[k];
    console.log(`${table}: ${rows} linha(s) — R2 ${counts.r2}, Supabase ${counts.supabase}, base64 ${counts.base64}, outros ${counts.outro}`);
}

// Conteúdo real do bucket
const bucketKeys = new Set();
let off = 0;
while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: '', limit: 100, offset: off, sortBy: { column: 'name', order: 'asc' } }),
    });
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    for (const o of page) if (o?.name) bucketKeys.add(o.name);
    off += 100;
    if (page.length < 100) break;
}

const orphans = [...bucketKeys].filter(k => !referencedKeys.has(k));
const missing = [...referencedKeys].filter(k => !bucketKeys.has(k));

console.log('\n--- totais ---');
console.log(`apontando para o R2       : ${totals.r2}`);
console.log(`apontando para o Supabase : ${totals.supabase}`);
console.log(`base64                    : ${totals.base64}`);
console.log(`outros                    : ${totals.outro}`);
console.log(`chaves distintas em uso   : ${referencedKeys.size}`);
console.log(`objetos no bucket         : ${bucketKeys.size}`);
console.log(`orfaos (sem referencia)   : ${orphans.length}`);
console.log(`referenciados fora do bucket: ${missing.length}`);
