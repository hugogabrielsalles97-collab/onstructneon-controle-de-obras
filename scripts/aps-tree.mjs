/**
 * Lista os primeiros níveis da árvore de objetos do modelo traduzido.
 *
 *   node --env-file=.env scripts/aps-tree.mjs [profundidade]
 *
 * Num federado, o primeiro nível costuma ser um nó por arquivo de origem —
 * é ali que se identifica o que é terreno, estrutura, terraplenagem etc.
 * Só lê.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, requireCredentials, REGION } from './aps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.aps-state.json');
const DEPTH = Number(process.argv[2] || 2);

requireCredentials();

if (!existsSync(STATE_FILE)) { console.error('Sem estado. Rode o upload primeiro.'); process.exit(1); }
const { urn } = JSON.parse(readFileSync(STATE_FILE, 'utf8'));

const meta = await api(`/modelderivative/v2/designdata/${urn}/metadata`, {
    headers: { 'x-ads-region': REGION },
    scopes: 'data:read viewables:read',
});

const guid = meta?.data?.metadata?.[0]?.guid;
if (!guid) { console.error('Nenhum viewable com metadados.'); process.exit(1); }

console.log(`viewable: ${meta.data.metadata[0].name}\nguid: ${guid}\n`);

// A árvore pode precisar ser gerada sob demanda: a APS responde 202 enquanto prepara.
let tree = null;
for (let tentativa = 0; tentativa < 12; tentativa++) {
    const res = await api(`/modelderivative/v2/designdata/${urn}/metadata/${guid}?forceget=true`, {
        headers: { 'x-ads-region': REGION },
        scopes: 'data:read viewables:read',
    });

    if (res?.data?.objects) { tree = res; break; }

    console.log('  arvore ainda sendo preparada, aguardando...');
    await new Promise(r => setTimeout(r, 10_000));
}

if (!tree) { console.error('A arvore nao ficou pronta a tempo. Rode de novo em alguns minutos.'); process.exit(1); }

writeFileSync(join(__dirname, '.aps-tree.json'), JSON.stringify(tree, null, 2));

const contar = (node) => 1 + (node.objects || []).reduce((s, c) => s + contar(c), 0);

const imprimir = (nodes, nivel = 0) => {
    for (const n of nodes) {
        const filhos = n.objects?.length || 0;
        const total = contar(n) - 1;
        console.log(`${'  '.repeat(nivel)}[${n.objectid}] ${n.name}${filhos ? `  (${filhos} filho(s), ${total} descendente(s))` : ''}`);
        if (nivel + 1 < DEPTH && n.objects) imprimir(n.objects, nivel + 1);
    }
};

imprimir(tree.data.objects);
console.log(`\narvore completa salva em scripts/.aps-tree.json`);
