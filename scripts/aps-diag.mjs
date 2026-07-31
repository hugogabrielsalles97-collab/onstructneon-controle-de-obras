/**
 * Diagnóstico rápido da conta APS: o token sai? as chamadas passam?
 *
 *   node --env-file=.env scripts/aps-diag.mjs
 */

import { api, getToken, requireCredentials, BUCKET_KEY } from './aps.mjs';

requireCredentials();

const probe = async (label, fn) => {
    try {
        const out = await fn();
        console.log(`OK    ${label}`);
        return out;
    } catch (err) {
        console.log(`FALHA ${label}\n        ${err.message}`);
        return null;
    }
};

await probe('token de aplicação', () => getToken());

await probe('detalhes do bucket', () => api(`/oss/v2/buckets/${BUCKET_KEY}/details`));

const objs = await probe('listar objetos do bucket', () =>
    api(`/oss/v2/buckets/${BUCKET_KEY}/objects`));

if (objs?.items) {
    console.log(`\n${objs.items.length} objeto(s) no bucket:`);
    for (const o of objs.items) {
        console.log(`  ${o.objectKey} — ${(o.size / 1024 / 1024).toFixed(1)} MB`);
        console.log(`    objectId: ${o.objectId}`);
    }
}

await probe('listar buckets da conta', () => api('/oss/v2/buckets?limit=10'));
