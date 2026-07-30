/**
 * Confere que TODA foto do Supabase tem uma cópia íntegra no R2.
 *
 *   node --env-file=.env scripts/verify-r2-copies.mjs
 *
 * Só lê. Não escreve, não apaga, não toca no banco.
 *
 * Para cada objeto do bucket do Supabase, faz um HEAD no Worker — que consulta
 * apenas o R2, sem fallback — e compara o tamanho com o que o Supabase reporta.
 * Este é o portão que deve passar 100% antes de apagar qualquer original.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.verify-report.json');
const BUCKET = 'task-photos';
const CONCURRENCY = 16;
const PAGE_SIZE = 100;

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const PHOTO_BASE_URL = (process.env.VITE_PHOTO_BASE_URL || '').trim().replace(/\/+$/, '');

if (!SUPABASE_URL || !ANON_KEY || !PHOTO_BASE_URL) {
    console.error('Faltam VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ou VITE_PHOTO_BASE_URL no .env.');
    process.exit(1);
}

async function listAllKeys() {
    const keys = [];
    let offset = 0;

    while (true) {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
            method: 'POST',
            headers: {
                apikey: ANON_KEY,
                Authorization: `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prefix: '',
                limit: PAGE_SIZE,
                offset,
                sortBy: { column: 'name', order: 'asc' },
            }),
        });

        if (!res.ok) throw new Error(`Listagem falhou (${res.status})`);

        const page = await res.json();
        if (!Array.isArray(page) || page.length === 0) break;

        for (const obj of page) {
            if (obj?.name) keys.push({ key: obj.name, size: Number(obj.metadata?.size || 0) });
        }

        offset += PAGE_SIZE;
        if (page.length < PAGE_SIZE) break;
    }

    return keys;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * HEAD com nova tentativa. Falha de rede da máquina que roda o script não pode
 * virar "foto ausente" — este relatório é o que autoriza apagar originais.
 */
async function headWithRetry(url, attempts = 4) {
    let lastError;

    for (let i = 0; i < attempts; i++) {
        try {
            return await fetch(url, { method: 'HEAD' });
        } catch (err) {
            lastError = err;
            await sleep(300 * 2 ** i);
        }
    }

    throw lastError;
}

async function verifyOne({ key, size }) {
    const res = await headWithRetry(`${PHOTO_BASE_URL}/${encodeURIComponent(key)}`);

    if (!res.ok) return { key, ok: false, reason: `ausente no R2 (HEAD ${res.status})` };
    if (res.headers.get('X-Photo-Source') !== 'r2') return { key, ok: false, reason: 'resposta não veio do R2' };

    const remote = Number(res.headers.get('Content-Length') || 0);
    if (size && remote !== size) {
        return { key, ok: false, reason: `tamanho difere: Supabase ${size}, R2 ${remote}` };
    }

    return { key, ok: true, size: remote };
}

async function run() {
    console.log('Listando objetos no Supabase...');
    const all = await listAllKeys();
    console.log(`${all.length} objeto(s) a verificar.\n`);

    const problems = [];
    let done = 0;
    let bytes = 0;
    let cursor = 0;

    const worker = async () => {
        while (cursor < all.length) {
            const item = all[cursor++];

            try {
                const result = await verifyOne(item);
                if (result.ok) bytes += result.size;
                else problems.push(result);
            } catch (err) {
                problems.push({ key: item.key, ok: false, reason: String(err.message || err) });
            }

            done++;
            if (done % 500 === 0 || done === all.length) {
                console.log(`  ${done}/${all.length} — ${problems.length} problema(s)`);
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    writeFileSync(REPORT_FILE, JSON.stringify({
        checkedAt: new Date().toISOString(),
        total: all.length,
        ok: all.length - problems.length,
        problems,
    }, null, 2));

    console.log(`\n${all.length - problems.length}/${all.length} verificada(s) com tamanho idêntico (${(bytes / 1024 / 1024).toFixed(1)} MB no R2).`);

    if (problems.length === 0) {
        console.log('\nTUDO CONFERE. Existe cópia íntegra de cada foto no R2.');
    } else {
        console.log(`\n${problems.length} PROBLEMA(S) — NÃO apague nada ainda. Detalhes em ${REPORT_FILE}`);
        for (const p of problems.slice(0, 10)) console.log(`  ${p.key}: ${p.reason}`);
        process.exitCode = 1;
    }
}

run().catch(err => {
    console.error('\nFalha crítica:', err);
    process.exit(1);
});
