/**
 * Teste de fumaça: pega URLs de foto reais do banco e busca cada uma como o
 * navegador faria, conferindo status e de onde veio a resposta.
 *
 *   node --env-file=.env scripts/smoke-test-photos.mjs [quantidade]
 *
 * Só lê. É a confirmação de ponta a ponta de que as fotos ainda abrem no ELOS.
 */

import { createClient } from '@supabase/supabase-js';
import { PHOTO_TABLES } from './photo-tables.mjs';

const SAMPLE = Number(process.argv[2] || 12);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const urls = [];

for (const table of PHOTO_TABLES) {
    let offset = 0;

    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('photos')
            .order('id', { ascending: true })
            .range(offset, offset + 199);

        if (error || !data || data.length === 0) break;

        for (const row of data) {
            if (!Array.isArray(row.photos)) continue;
            for (const p of row.photos) if (typeof p === 'string' && p.startsWith('http')) urls.push(p);
        }

        offset += 200;
    }
}

if (urls.length === 0) {
    console.log('Nenhuma URL de foto encontrada no banco.');
    process.exit(0);
}

// Amostra aleatória, para não testar sempre as mesmas.
const picked = [];
const pool = [...urls];
for (let i = 0; i < Math.min(SAMPLE, pool.length); i++) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
}

console.log(`${urls.length} URL(s) no banco. Testando ${picked.length}:\n`);

let ok = 0;
let bad = 0;

for (const url of picked) {
    try {
        const res = await fetch(url);
        const size = res.headers.get('Content-Length') || '?';
        const src = res.headers.get('X-Photo-Source') || '-';
        const name = url.split('/').pop();

        if (res.ok) { ok++; console.log(`  ${res.status}  ${src.padEnd(18)} ${String(size).padStart(8)} B  ${name}`); }
        else { bad++; console.log(`  ${res.status}  FALHOU  ${name}`); }
    } catch (err) {
        bad++;
        console.log(`  ERRO  ${url}: ${err.message}`);
    }
}

console.log(`\n${ok} ok, ${bad} com problema.`);
if (bad > 0) process.exitCode = 1;
