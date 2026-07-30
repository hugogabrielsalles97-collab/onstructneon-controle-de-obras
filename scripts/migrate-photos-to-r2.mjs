/**
 * Etapas 2 e 3 da migração de fotos: reescrever as URLs no banco e, só então,
 * liberar espaço no Supabase.
 *
 *   node --env-file=.env scripts/migrate-photos-to-r2.mjs            # reescreve URLs
 *   node --env-file=.env scripts/migrate-photos-to-r2.mjs --delete   # + apaga originais
 *
 * A cópia dos arquivos é feita pelo scripts/copy-photos-to-r2.mjs, que não
 * mexe em nada. Este aqui altera o banco, e com --delete apaga do Supabase —
 * por isso cada passo é condicionado a uma verificação independente.
 *
 * Regras de segurança, nesta ordem:
 *   1. Uma URL só é reescrita se o objeto responder por HEAD no R2. O HEAD do
 *      Worker consulta apenas o R2, sem fallback, então não há como ele
 *      confirmar um arquivo que na verdade só existe no Supabase.
 *   2. Um original só é apagado se a chave estiver confirmada no R2 E não
 *      houver mais nenhuma referência a ela em formato Supabase no banco.
 *
 * Precisa da SUPABASE_SERVICE_ROLE_KEY no .env (só roda na sua máquina).
 */

import { createClient } from '@supabase/supabase-js';
import { PHOTO_TABLES, BUCKET } from './photo-tables.mjs';

const PAGE_SIZE = 50;
const DELETE_BATCH = 100;
const VERIFY_CONCURRENCY = 24;
const UPDATE_CONCURRENCY = 8;

const DO_DELETE = process.argv.includes('--delete');
const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PHOTO_BASE_URL = (process.env.VITE_PHOTO_BASE_URL || '').trim().replace(/\/+$/, '');

for (const [name, value] of Object.entries({
    VITE_SUPABASE_URL: SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
    VITE_PHOTO_BASE_URL: PHOTO_BASE_URL,
})) {
    if (!value) {
        console.error(`Faltando ${name} no .env. Abortando.`);
        process.exit(1);
    }
}

const SUPABASE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const keyFromUrl = (url) => decodeURIComponent(url.slice(SUPABASE_PREFIX.length).split('?')[0]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Verificação estrita: o objeto está mesmo no R2? (HEAD não faz fallback.)
 * Repete em falha de rede — uma conexão instável não pode fazer uma foto
 * parecer ausente, porque é esta resposta que libera apagar o original.
 */
async function isInR2(key, attempts = 4) {
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(`${PHOTO_BASE_URL}/${encodeURIComponent(key)}`, { method: 'HEAD' });
            return res.ok && res.headers.get('X-Photo-Source') === 'r2';
        } catch {
            await sleep(300 * 2 ** i);
        }
    }
    return false;
}

/** Roda `fn` sobre `items` com N execuções simultâneas. */
async function pool(items, size, fn) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
        while (cursor < items.length) await fn(items[cursor++]);
    });
    await Promise.all(runners);
}

/**
 * Reescreve as URLs do Supabase para o Worker.
 *
 * Em três fases, para não fazer uma requisição de rede por foto em série:
 * junta as tarefas afetadas, confirma as chaves no R2 em paralelo, e só então
 * grava. A verificação por chave continua obrigatória — o que mudou é que ela
 * acontece uma vez por chave distinta, concorrentemente, e não embutida no laço.
 */
async function rewriteUrls() {
    // Fase 1: varrer todas as tabelas com foto e juntar o que precisa mudar.
    const affected = [];
    const keys = new Set();

    for (const table of PHOTO_TABLES) {
        let offset = 0;

        while (true) {
            const { data: rows, error } = await supabase
                .from(table)
                .select('id, photos')
                .order('id', { ascending: true })
                .range(offset, offset + PAGE_SIZE - 1);

            if (error) throw error;
            if (!rows || rows.length === 0) break;

            for (const row of rows) {
                if (!Array.isArray(row.photos)) continue;
                if (!row.photos.some(p => typeof p === 'string' && p.startsWith(SUPABASE_PREFIX))) continue;

                affected.push({ ...row, table });
                for (const photo of row.photos) {
                    if (typeof photo === 'string' && photo.startsWith(SUPABASE_PREFIX)) keys.add(keyFromUrl(photo));
                }
            }

            offset += PAGE_SIZE;
        }
    }

    console.log(`  ${affected.length} linha(s) com foto ainda no Supabase, ${keys.size} chave(s) distinta(s).`);

    if (affected.length === 0) return { rewritten: 0, skipped: 0, tasksTouched: 0 };

    // Fase 2: confirmar cada chave no R2, em paralelo.
    const verified = new Set();
    let checked = 0;

    await pool([...keys], VERIFY_CONCURRENCY, async (key) => {
        if (await isInR2(key)) verified.add(key);
        checked++;
        if (checked % 500 === 0) console.log(`  verificadas ${checked}/${keys.size}`);
    });

    console.log(`  ${verified.size}/${keys.size} confirmada(s) no R2.`);

    // Fase 3: gravar, consultando só a memória.
    let rewritten = 0;
    let skipped = 0;
    let tasksTouched = 0;

    await pool(affected, UPDATE_CONCURRENCY, async (row) => {
        const newPhotos = [];
        let changed = false;

        for (const photo of row.photos) {
            if (typeof photo !== 'string' || !photo.startsWith(SUPABASE_PREFIX)) {
                newPhotos.push(photo);
                continue;
            }

            const key = keyFromUrl(photo);

            if (verified.has(key)) {
                newPhotos.push(`${PHOTO_BASE_URL}/${key}`);
                changed = true;
                rewritten++;
            } else {
                newPhotos.push(photo); // ainda não copiada — fica como está
                skipped++;
            }
        }

        if (!changed || DRY_RUN) return;

        const { error: updateError } = await supabase
            .from(row.table)
            .update({ photos: newPhotos })
            .eq('id', row.id);

        if (updateError) {
            console.error(`  ERRO em ${row.table}/${row.id}: ${updateError.message}`);
            return;
        }

        tasksTouched++;
        if (tasksTouched % 200 === 0) console.log(`  ${tasksTouched}/${affected.length} linha(s) gravada(s)`);
    });

    return { rewritten, skipped, tasksTouched };
}

/** Junta todas as chaves ainda referenciadas em formato Supabase no banco. */
async function keysStillReferenced() {
    const referenced = new Set();

    for (const table of PHOTO_TABLES) {
        let offset = 0;

        while (true) {
            const { data: rows, error } = await supabase
                .from(table)
                .select('id, photos')
                .order('id', { ascending: true })
                .range(offset, offset + PAGE_SIZE - 1);

            if (error) throw error;
            if (!rows || rows.length === 0) break;

            for (const row of rows) {
                if (!Array.isArray(row.photos)) continue;
                for (const photo of row.photos) {
                    if (typeof photo === 'string' && photo.startsWith(SUPABASE_PREFIX)) {
                        referenced.add(keyFromUrl(photo));
                    }
                }
            }

            offset += PAGE_SIZE;
        }
    }

    return referenced;
}

async function deleteOriginals() {
    console.log('\nLevantando o que ainda aponta para o Supabase...');
    const stillReferenced = await keysStillReferenced();
    console.log(`${stillReferenced.size} chave(s) ainda referenciada(s) — essas NÃO serão tocadas.`);

    // Listar TUDO antes de apagar. Paginar por offset enquanto se remove faz a
    // listagem deslocar sob os pés do laço, e metade dos objetos passa batido.
    console.log('Listando o bucket...');
    const allKeys = [];
    let listOffset = 0;

    while (true) {
        const { data: objects, error } = await supabase.storage
            .from(BUCKET)
            .list('', { limit: 100, offset: listOffset, sortBy: { column: 'name', order: 'asc' } });

        if (error) throw error;
        if (!objects || objects.length === 0) break;

        for (const obj of objects) if (obj?.name) allKeys.push(obj.name);

        listOffset += 100;
        if (objects.length < 100) break;
    }

    console.log(`${allKeys.length} objeto(s) no bucket.`);

    let deleted = 0;
    let held = 0;
    let batch = [];

    const flush = async () => {
        if (batch.length === 0) return;
        if (DRY_RUN) {
            deleted += batch.length;
            batch = [];
            return;
        }

        const { error } = await supabase.storage.from(BUCKET).remove(batch);
        if (error) console.error(`  ERRO ao apagar lote: ${error.message}`);
        else deleted += batch.length;

        console.log(`  ${deleted} original(is) apagado(s)`);
        batch = [];
    };

    // Descarta o que ainda é referenciado, confirma o resto no R2 em paralelo.
    const candidates = allKeys.filter(k => !stillReferenced.has(k));
    held += allKeys.length - candidates.length;

    const confirmed = [];
    let checked = 0;

    await pool(candidates, VERIFY_CONCURRENCY, async (key) => {
        if (await isInR2(key)) confirmed.push(key);
        else held++;

        checked++;
        if (checked % 500 === 0) console.log(`  confirmadas ${checked}/${candidates.length}`);
    });

    console.log(`${confirmed.length} confirmada(s) no R2 e sem referencia — apagando.`);

    for (const key of confirmed) {
        batch.push(key);
        if (batch.length >= DELETE_BATCH) await flush();
    }

    await flush();
    return { deleted, held };
}

async function run() {
    console.log(`Modo: ${DRY_RUN ? 'DRY RUN' : 'gravando'}${DO_DELETE ? ' + apagar originais' : ''}\n`);
    console.log('Reescrevendo URLs (só as confirmadas no R2)...');

    const r = await rewriteUrls();
    console.log(`\n${r.rewritten} URL(s) reescrita(s) em ${r.tasksTouched} tarefa(s).`);
    if (r.skipped > 0) {
        console.log(`${r.skipped} mantida(s) no Supabase por ainda não estarem no R2 — rode copy-photos-to-r2.mjs antes.`);
    }

    if (!DO_DELETE) {
        console.log('\nNada foi apagado. Confira as fotos no ELOS e rode com --delete para liberar espaço.');
        return;
    }

    const d = await deleteOriginals();
    console.log(`\n${d.deleted} original(is) apagado(s), ${d.held} preservado(s) por precaução.`);
    console.log('Confira o uso em Storage -> Usage no painel do Supabase.');
}

run().catch(err => {
    console.error('\nFalha crítica:', err);
    process.exit(1);
});
