/**
 * Resume o manifesto da tradução: o que saiu, quantos arquivos e quantos MB.
 *
 *   node --env-file=.env scripts/aps-manifest.mjs
 *   node --env-file=.env scripts/aps-manifest.mjs --tree   # + árvore de objetos
 *
 * É o número que decide entre servir pelo Viewer da APS ou converter para
 * glTF e hospedar por conta própria.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, requireCredentials, REGION } from './aps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.aps-state.json');

requireCredentials();

if (!existsSync(STATE_FILE)) {
    console.error('Sem estado. Rode o upload primeiro.');
    process.exit(1);
}

const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
const urn = state.urn;
const SHOW_TREE = process.argv.includes('--tree');

const manifest = await api(`/modelderivative/v2/designdata/${urn}/manifest`, {
    headers: { 'x-ads-region': REGION },
    scopes: 'data:read viewables:read',
});

const byRole = new Map();
let totalBytes = 0;
let fileCount = 0;

const walk = (node) => {
    if (!node) return;

    if (typeof node.size === 'number' && node.size > 0) {
        totalBytes += node.size;
        fileCount++;
        const role = node.role || node.type || 'outro';
        const cur = byRole.get(role) || { bytes: 0, count: 0 };
        byRole.set(role, { bytes: cur.bytes + node.size, count: cur.count + 1 });
    }

    for (const child of node.children || []) walk(child);
};

for (const d of manifest.derivatives || []) walk(d);

const viewables = [];
const collectViewables = (node) => {
    if (node?.role === '3d' && node.type === 'geometry') viewables.push(node.name || node.guid);
    for (const c of node?.children || []) collectViewables(c);
};
for (const d of manifest.derivatives || []) collectViewables(d);

console.log(`arquivo : ${state.file}`);
console.log(`status  : ${manifest.status}`);
console.log(`\nderivativos: ${fileCount} arquivo(s), ${(totalBytes / 1024 / 1024).toFixed(1)} MB no total`);

for (const [role, v] of [...byRole.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12)) {
    console.log(`  ${String(role).padEnd(22)} ${String(v.count).padStart(5)} arq  ${(v.bytes / 1024 / 1024).toFixed(1)} MB`);
}

console.log(`\nviewables 3D: ${viewables.length}`);
for (const v of viewables.slice(0, 10)) console.log(`  ${v}`);

if (SHOW_TREE) {
    const meta = await api(`/modelderivative/v2/designdata/${urn}/metadata`, {
        headers: { 'x-ads-region': REGION },
        scopes: 'data:read viewables:read',
    });

    console.log('\nmetadados:');
    for (const m of meta?.data?.metadata || []) console.log(`  ${m.role}  ${m.name}  guid=${m.guid}`);
}

writeFileSync(join(__dirname, '.aps-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nmanifesto completo salvo em scripts/.aps-manifest.json`);

// --- Medição real: o manifesto não traz tamanho, então perguntamos arquivo a arquivo.
const derivativeUrns = [];
const collectUrns = (node) => {
    if (node?.urn) derivativeUrns.push({ urn: node.urn, role: node.role, mime: node.mime });
    for (const c of node?.children || []) collectUrns(c);
};
for (const d of manifest.derivatives || []) collectUrns(d);

console.log(`\n${derivativeUrns.length} arquivo(s) de derivativo referenciados no manifesto.`);

if (!process.argv.includes('--measure')) {
    console.log('Rode com --measure para somar os tamanhos (uma consulta por arquivo).');
    process.exit(0);
}

const { getToken } = await import('./aps.mjs');
const token = await getToken('data:read viewables:read');

let measured = 0;
let bytes = 0;
const failures = [];
const perRole = new Map();
let cursor = 0;

const workers = Array.from({ length: 10 }, async () => {
    while (cursor < derivativeUrns.length) {
        const item = derivativeUrns[cursor++];

        try {
            const res = await fetch(
                `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest/${encodeURIComponent(item.urn)}`,
                { method: 'HEAD', headers: { Authorization: `Bearer ${token}` } }
            );

            const size = Number(res.headers.get('Content-Length') || 0);
            if (res.ok && size) {
                bytes += size;
                const cur = perRole.get(item.role || '?') || { bytes: 0, count: 0 };
                perRole.set(item.role || '?', { bytes: cur.bytes + size, count: cur.count + 1 });
            } else if (!res.ok) {
                failures.push(`${res.status} ${item.urn.split('/').pop()}`);
            }
        } catch (err) {
            failures.push(`${err.message} ${item.urn.split('/').pop()}`);
        }

        measured++;
        if (measured % 200 === 0) console.log(`  ${measured}/${derivativeUrns.length} — ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    }
});

await Promise.all(workers);

console.log(`\n=== TAMANHO DOS DERIVATIVOS ===`);
console.log(`${measured} arquivo(s) consultados, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
for (const [role, v] of [...perRole.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${String(role).padEnd(24)} ${String(v.count).padStart(5)} arq  ${(v.bytes / 1024 / 1024).toFixed(1)} MB`);
}
if (failures.length) console.log(`\n${failures.length} falha(s), ex.: ${failures.slice(0, 5).join(' | ')}`);
