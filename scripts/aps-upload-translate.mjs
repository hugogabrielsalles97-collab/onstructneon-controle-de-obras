/**
 * Sobe um modelo para a APS e dispara a tradução do Model Derivative.
 *
 *   node --env-file=.env scripts/aps-upload-translate.mjs "C:\\caminho\\modelo.nwd"
 *   node --env-file=.env scripts/aps-upload-translate.mjs --status   # só consulta
 *
 * O upload usa o fluxo assinado em partes, obrigatório acima de 100 MB. Cada
 * parte vai direto para o S3 da Autodesk — os bytes não passam pela API.
 *
 * Guarda o urn em scripts/.aps-state.json para os passos seguintes.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, getToken, toUrn, requireCredentials, BUCKET_KEY, REGION } from './aps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.aps-state.json');

const PART_SIZE = 64 * 1024 * 1024;   // 64 MB por parte
const PART_CONCURRENCY = 3;
const URL_EXPIRATION_MIN = 60;

requireCredentials();

const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// Estado antigo guardava um único upload pendente; agora é um mapa por objeto.
if (state.pendingUpload?.objectKey) {
    const { objectKey, ...rest } = state.pendingUpload;
    state.pendingUploads = { ...(state.pendingUploads || {}), [objectKey]: rest };
    delete state.pendingUpload;
    saveState();
}

const args = process.argv.slice(2);
const STATUS_ONLY = args.includes('--status');
const COMPLETE_ONLY = args.includes('--complete');
const NO_TRANSLATE = args.includes('--no-translate');
const WAIT = args.includes('--wait');
const filePath = args.find(a => !a.startsWith('--'));

/** Nome de objeto seguro: a APS não gosta de espaços e parênteses. */
const objectKeyFor = (p) => basename(p).replace(/[^A-Za-z0-9._-]/g, '_');

async function ensureBucket() {
    try {
        await api(`/oss/v2/buckets/${BUCKET_KEY}/details`);
        console.log(`Bucket ${BUCKET_KEY} já existe.`);
        return;
    } catch (err) {
        if (!String(err.message).includes('404')) throw err;
    }

    await api('/oss/v2/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ads-region': REGION },
        // persistent: o arquivo não expira sozinho. transient some em 24h.
        body: JSON.stringify({ bucketKey: BUCKET_KEY, policyKey: 'persistent' }),
    });

    console.log(`Bucket ${BUCKET_KEY} criado na região ${REGION}.`);
}

async function uploadPart(url, buffer, label, attempts = 4) {
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(url, { method: 'PUT', body: buffer });
            if (res.ok) return;
            if (res.status < 500 && res.status !== 429) {
                throw new Error(`${label}: ${res.status} ${await res.text().catch(() => '')}`);
            }
        } catch (err) {
            if (i === attempts - 1) throw new Error(`${label}: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
    throw new Error(`${label}: esgotou as tentativas`);
}

async function uploadFile(path) {
    const size = statSync(path).size;
    const objectKey = objectKeyFor(path);
    const totalParts = Math.ceil(size / PART_SIZE);

    console.log(`\nArquivo : ${basename(path)}`);
    console.log(`Tamanho : ${(size / 1024 / 1024).toFixed(1)} MB em ${totalParts} parte(s)`);
    console.log(`Destino : ${BUCKET_KEY}/${objectKey}\n`);

    const signed = await api(
        `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload` +
        `?parts=${totalParts}&firstPart=1&minutesExpiration=${URL_EXPIRATION_MIN}`
    );

    const { uploadKey, urls } = signed;

    // Guarda antes de subir: se a chamada que fecha o upload falhar, dá para
    // retomar com --complete em vez de re-enviar centenas de MB. Indexado por
    // objeto — um upload de teste não pode apagar a chave de outro.
    state.pendingUploads = state.pendingUploads || {};
    state.pendingUploads[objectKey] = { uploadKey, totalParts, size, startedAt: new Date().toISOString() };
    saveState();

    const handle = await open(path, 'r');
    let done = 0;
    let sentBytes = 0;
    const startedAt = Date.now();

    try {
        let cursor = 0;
        const workers = Array.from({ length: Math.min(PART_CONCURRENCY, totalParts) }, async () => {
            while (cursor < totalParts) {
                const index = cursor++;
                const offset = index * PART_SIZE;
                const length = Math.min(PART_SIZE, size - offset);
                const buffer = Buffer.allocUnsafe(length);

                await handle.read(buffer, 0, length, offset);
                await uploadPart(urls[index], buffer, `parte ${index + 1}`);

                done++;
                sentBytes += length;
                const mbps = (sentBytes / 1024 / 1024) / ((Date.now() - startedAt) / 1000);
                console.log(`  ${done}/${totalParts} parte(s) — ${(sentBytes / 1024 / 1024).toFixed(0)} MB, ${mbps.toFixed(1)} MB/s`);
            }
        });

        await Promise.all(workers);
    } finally {
        await handle.close();
    }

    return completeUpload(objectKey, uploadKey);
}

/** Fecha o upload em partes. Separado para poder ser repetido sozinho. */
async function completeUpload(objectKey, uploadKey) {
    const completed = await api(
        `/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadKey }),
        }
    );

    if (state.pendingUploads) delete state.pendingUploads[objectKey];
    saveState();

    console.log(`\nUpload concluído. objectId: ${completed.objectId}`);
    return completed.objectId;
}

async function startTranslation(urn) {
    // SVF (e não SVF2) de propósito: os derivativos do SVF podem ser baixados e
    // convertidos para glTF, que é o caminho para hospedar o modelo por conta
    // própria depois. O Viewer abre os dois formatos.
    const job = await api('/modelderivative/v2/designdata/job', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-ads-force': 'true',
            'x-ads-region': REGION,
        },
        body: JSON.stringify({
            input: { urn },
            output: { formats: [{ type: 'svf', views: ['3d'] }] },
        }),
    });

    console.log(`\nTradução disparada: ${job.result}`);
    return job;
}

async function checkStatus(urn) {
    try {
        const manifest = await api(`/modelderivative/v2/designdata/${urn}/manifest`, {
            headers: { 'x-ads-region': REGION },
            scopes: 'data:read viewables:read',
        });

        console.log(`status   : ${manifest.status}`);
        console.log(`progresso: ${manifest.progress}`);

        for (const d of manifest.derivatives || []) {
            console.log(`  ${d.outputType}: ${d.status} ${d.progress || ''}`);
            for (const m of d.messages || []) {
                console.log(`    [${m.type}] ${Array.isArray(m.message) ? m.message.join(' | ') : m.message}`);
            }
        }

        return manifest;
    } catch (err) {
        if (String(err.message).includes('404')) {
            console.log('Manifesto ainda não existe — a tradução pode não ter começado.');
            return null;
        }
        throw err;
    }
}

async function run() {
    if (STATUS_ONLY) {
        if (!state.urn) { console.error('Nenhum urn guardado. Rode o upload primeiro.'); process.exitCode = 1; return; }
        console.log(`urn: ${state.urn}\n`);

        if (!WAIT) { await checkStatus(state.urn); return; }

        // Acompanha até terminar. A tradução de um modelo federado grande pode
        // levar horas, então o intervalo é generoso de propósito.
        const startedAt = Date.now();
        while (true) {
            const manifest = await checkStatus(state.urn);
            const status = manifest?.status;

            if (status === 'success' || status === 'failed' || status === 'timeout') {
                const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
                console.log(`\nTradução terminou como "${status}" após ${mins} min de acompanhamento.`);
                if (status !== 'success') process.exitCode = 1;
                return;
            }

            await new Promise(r => setTimeout(r, 60_000));
            console.log('---');
        }
    }

    if (COMPLETE_ONLY) {
        const pending = state.pendingUploads || {};
        const wanted = filePath ? objectKeyFor(filePath) : Object.keys(pending)[0];

        if (!wanted || !pending[wanted]) {
            console.error('Não há upload pendente para fechar.');
            if (Object.keys(pending).length) console.error(`Pendentes: ${Object.keys(pending).join(', ')}`);
            process.exitCode = 1;
            return;
        }

        const objectKey = wanted;
        const { uploadKey } = pending[objectKey];
        console.log(`Fechando upload pendente de ${objectKey}...`);

        const objectId = await completeUpload(objectKey, uploadKey);
        state.objectId = objectId;
        state.urn = toUrn(objectId);
        saveState();

        console.log(`urn: ${state.urn}`);
        if (!NO_TRANSLATE) await startTranslation(state.urn);
        return;
    }

    if (!filePath || !existsSync(filePath)) {
        console.error('Informe o caminho do modelo. Ex.:');
        console.error('  node --env-file=.env scripts/aps-upload-translate.mjs "C:\\\\Users\\\\User\\\\Downloads\\\\modelo.nwd"');
        process.exitCode = 1;
        return;
    }

    await getToken(); // falha cedo se as credenciais estiverem erradas
    await ensureBucket();

    const objectId = await uploadFile(filePath);
    const urn = toUrn(objectId);

    state.objectId = objectId;
    state.urn = urn;
    state.file = basename(filePath);
    state.uploadedAt = new Date().toISOString();
    saveState();

    console.log(`urn: ${urn}`);

    if (NO_TRANSLATE) {
        console.log('\n--no-translate: upload feito, tradução não disparada (nenhum token gasto).');
        return;
    }

    await startTranslation(urn);

    console.log('\nA tradução roda no servidor da Autodesk e leva de minutos a algumas horas.');
    console.log('Acompanhe com:');
    console.log('  node --env-file=.env scripts/aps-upload-translate.mjs --status');
}

run().catch(err => {
    console.error(`\n${err.message}`);
    saveState();
    process.exitCode = 1;
});
