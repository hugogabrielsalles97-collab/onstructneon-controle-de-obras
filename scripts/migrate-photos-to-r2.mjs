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

const BUCKET = 'task-photos';
const PAGE_SIZE = 50;
const DELETE_BATCH = 100;

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

/** Verificação estrita: o objeto está mesmo no R2? (HEAD não faz fallback.) */
async function isInR2(key) {
    try {
        const res = await fetch(`${PHOTO_BASE_URL}/${encodeURIComponent(key)}`, { method: 'HEAD' });
        return res.ok && res.headers.get('X-Photo-Source') === 'r2';
    } catch {
        return false;
    }
}

/** Reescreve as URLs do Supabase para o Worker, uma tarefa por vez. */
async function rewriteUrls() {
    let offset = 0;
    let rewritten = 0;
    let skipped = 0;
    let tasksTouched = 0;

    while (true) {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('id, photos')
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!tasks || tasks.length === 0) break;

        for (const task of tasks) {
            if (!Array.isArray(task.photos)) continue;
            if (!task.photos.some(p => typeof p === 'string' && p.startsWith(SUPABASE_PREFIX))) continue;

            const newPhotos = [];
            let changed = false;

            for (const photo of task.photos) {
                if (typeof photo !== 'string' || !photo.startsWith(SUPABASE_PREFIX)) {
                    newPhotos.push(photo);
                    continue;
                }

                const key = keyFromUrl(photo);

                if (await isInR2(key)) {
                    newPhotos.push(`${PHOTO_BASE_URL}/${key}`);
                    changed = true;
                    rewritten++;
                } else {
                    newPhotos.push(photo); // ainda não copiada — fica como está
                    skipped++;
                }
            }

            if (changed && !DRY_RUN) {
                const { error: updateError } = await supabase
                    .from('tasks')
                    .update({ photos: newPhotos })
                    .eq('id', task.id);

                if (updateError) {
                    console.error(`  ERRO na tarefa ${task.id}: ${updateError.message}`);
                    continue;
                }
                tasksTouched++;
            }
        }

        offset += PAGE_SIZE;
        console.log(`  ...${offset} tarefa(s) examinada(s), ${rewritten} URL(s) reescrita(s)`);
    }

    return { rewritten, skipped, tasksTouched };
}

/** Junta todas as chaves ainda referenciadas em formato Supabase no banco. */
async function keysStillReferenced() {
    const referenced = new Set();
    let offset = 0;

    while (true) {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('photos')
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!tasks || tasks.length === 0) break;

        for (const task of tasks) {
            if (!Array.isArray(task.photos)) continue;
            for (const photo of task.photos) {
                if (typeof photo === 'string' && photo.startsWith(SUPABASE_PREFIX)) {
                    referenced.add(keyFromUrl(photo));
                }
            }
        }

        offset += PAGE_SIZE;
    }

    return referenced;
}

async function deleteOriginals() {
    console.log('\nLevantando o que ainda aponta para o Supabase...');
    const stillReferenced = await keysStillReferenced();
    console.log(`${stillReferenced.size} chave(s) ainda referenciada(s) — essas NÃO serão tocadas.`);

    let offset = 0;
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

    while (true) {
        const { data: objects, error } = await supabase.storage
            .from(BUCKET)
            .list('', { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });

        if (error) throw error;
        if (!objects || objects.length === 0) break;

        for (const obj of objects) {
            const key = obj.name;

            if (stillReferenced.has(key)) { held++; continue; }
            if (!(await isInR2(key))) { held++; continue; }

            batch.push(key);
            if (batch.length >= DELETE_BATCH) await flush();
        }

        offset += 100;
        if (objects.length < 100) break;
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
