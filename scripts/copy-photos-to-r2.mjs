/**
 * Copia em massa as fotos do Storage do Supabase para o R2.
 *
 *   node --env-file=.env scripts/copy-photos-to-r2.mjs
 *
 * Este script é deliberadamente inofensivo: ele NÃO escreve no banco e NÃO
 * apaga nada. Só garante que exista uma cópia de cada foto no R2 antes de
 * qualquer outra etapa. Pode ser interrompido e retomado à vontade — o estado
 * fica em scripts/.copy-state.json e chaves já copiadas são puladas.
 *
 * A cópia é feita pelo Worker (servidor-a-servidor); os bytes não passam
 * por esta máquina.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.copy-state.json');
const BUCKET = 'task-photos';
const CONCURRENCY = 12;
const PAGE_SIZE = 100;

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const PHOTO_BASE_URL = (process.env.VITE_PHOTO_BASE_URL || '').trim().replace(/\/+$/, '');
const MIGRATION_TOKEN = (process.env.MIGRATION_TOKEN || '').trim();

for (const [name, value] of Object.entries({
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: ANON_KEY,
    VITE_PHOTO_BASE_URL: PHOTO_BASE_URL,
    MIGRATION_TOKEN,
})) {
    if (!value) {
        console.error(`Faltando ${name} no .env. Abortando.`);
        process.exit(1);
    }
}

const state = existsSync(STATE_FILE)
    ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    : { copied: [], failed: {} };

const copied = new Set(state.copied);
const saveState = () => {
    state.copied = [...copied];
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

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

        if (!res.ok) throw new Error(`Listagem falhou (${res.status}): ${await res.text()}`);

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

async function copyOne({ key, size }) {
    const res = await fetch(`${PHOTO_BASE_URL}/_copy`, {
        method: 'POST',
        headers: {
            'X-Migration-Token': MIGRATION_TOKEN,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
    });

    if (!res.ok) {
        throw new Error(`${res.status} ${await res.text().catch(() => '')}`.trim());
    }

    const body = await res.json();

    // Confere o tamanho contra o que o Supabase reportou. Divergência aqui
    // significaria cópia truncada — melhor saber agora do que depois.
    if (size && body.size && Number(body.size) !== size) {
        throw new Error(`tamanho divergente: Supabase ${size}, R2 ${body.size}`);
    }

    return body;
}

async function run() {
    console.log('Listando objetos no Supabase...');
    const all = await listAllKeys();
    const pending = all.filter(o => !copied.has(o.key));

    const totalBytes = all.reduce((sum, o) => sum + o.size, 0);
    console.log(`${all.length} objeto(s), ${(totalBytes / 1024 / 1024).toFixed(1)} MB no total.`);
    console.log(`${copied.size} já copiado(s), ${pending.length} pendente(s).\n`);

    if (pending.length === 0) {
        console.log('Nada a fazer.');
        return;
    }

    let done = 0;
    let failures = 0;
    let cursor = 0;

    const worker = async () => {
        while (cursor < pending.length) {
            const item = pending[cursor++];

            try {
                await copyOne(item);
                copied.add(item.key);
                delete state.failed[item.key];
            } catch (err) {
                failures++;
                state.failed[item.key] = String(err.message || err);
                console.error(`  ERRO ${item.key}: ${err.message}`);
            }

            done++;
            if (done % 50 === 0 || done === pending.length) {
                saveState();
                const pct = ((done / pending.length) * 100).toFixed(1);
                console.log(`  ${done}/${pending.length} (${pct}%) — ${failures} falha(s)`);
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    saveState();

    console.log(`\nConcluído: ${copied.size}/${all.length} no R2, ${failures} falha(s) nesta rodada.`);
    if (failures > 0) {
        console.log(`Detalhes das falhas em ${STATE_FILE}. Rode de novo para tentar só as pendentes.`);
    }
    console.log('\nNenhum dado foi alterado no banco e nada foi apagado do Supabase.');
}

run().catch(err => {
    console.error('\nFalha crítica:', err);
    saveState();
    process.exit(1);
});
