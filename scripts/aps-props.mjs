/**
 * Mostra as propriedades de elementos do modelo.
 *
 *   node --env-file=.env scripts/aps-props.mjs 12345 12346
 *   node --env-file=.env scripts/aps-props.mjs --camada F-HZ-ESTACA --n 3
 *
 * É por aqui que se descobre se o modelo carrega estaqueamento, material,
 * volume e o que mais der para amarrar às tarefas do ELOS. Só lê.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, requireCredentials, REGION } from './aps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESTADO = join(__dirname, '.aps-state.json');
const ARVORE = join(__dirname, '.aps-tree.json');

requireCredentials();

if (!existsSync(ESTADO)) { console.error('Rode antes o upload.'); process.exit(1); }
const { urn } = JSON.parse(readFileSync(ESTADO, 'utf8'));

const args = process.argv.slice(2);
const valorDe = (flag, padrao) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : padrao;
};

const camadaAlvo = valorDe('--camada', null);
const quantos = Number(valorDe('--n', 3));

// Ignora o que vier logo depois de uma flag: senão o "2" de "--n 2" seria
// confundido com um objectId.
const valoresDeFlag = new Set();
for (const flag of ['--camada', '--n']) {
    const i = args.indexOf(flag);
    if (i !== -1 && args[i + 1]) valoresDeFlag.add(String(i + 1));
}

let objectIds = args
    .filter((a, i) => /^\d+$/.test(a) && !valoresDeFlag.has(String(i)))
    .map(Number);

// Sem ids explícitos: pega amostras da camada pedida, usando a árvore baixada.
if (objectIds.length === 0 && camadaAlvo) {
    if (!existsSync(ARVORE)) { console.error('Rode antes: scripts/aps-tree.mjs'); process.exit(1); }

    const tree = JSON.parse(readFileSync(ARVORE, 'utf8'));
    const encontrados = [];

    const buscar = (no) => {
        if (encontrados.length >= quantos) return;
        if (no.name === camadaAlvo) {
            const folhas = [];
            const descer = (n) => {
                if (folhas.length >= quantos) return;
                if (!n.objects?.length) { folhas.push(n.objectid); return; }
                for (const f of n.objects) descer(f);
            };
            descer(no);
            encontrados.push(...folhas.slice(0, quantos));
            return;
        }
        for (const f of no.objects || []) buscar(f);
    };

    buscar(tree.data.objects[0]);
    objectIds = encontrados;
    console.log(`Amostra da camada "${camadaAlvo}": ${objectIds.join(', ')}\n`);
}

if (objectIds.length === 0) {
    console.error('Informe objectIds ou --camada NOME.');
    process.exit(1);
}

const meta = await api(`/modelderivative/v2/designdata/${urn}/metadata`, {
    headers: { 'x-ads-region': REGION },
    scopes: 'data:read viewables:read',
});
const guid = meta.data.metadata[0].guid;

for (const objectid of objectIds) {
    let resposta = null;

    for (let tentativa = 0; tentativa < 10; tentativa++) {
        resposta = await api(
            `/modelderivative/v2/designdata/${urn}/metadata/${guid}/properties?objectid=${objectid}&forceget=true`,
            { headers: { 'x-ads-region': REGION }, scopes: 'data:read viewables:read' }
        );

        if (resposta?.data?.collection) break;
        console.log('  banco de propriedades sendo preparado, aguardando...');
        await new Promise(r => setTimeout(r, 10_000));
    }

    const item = resposta?.data?.collection?.[0];
    if (!item) { console.log(`\n[${objectid}] sem propriedades.`); continue; }

    console.log(`\n=== [${objectid}] ${item.name} ===`);
    for (const [grupo, props] of Object.entries(item.properties || {})) {
        console.log(`  ${grupo}`);
        for (const [chave, valor] of Object.entries(props)) {
            if (valor === '' || valor === null) continue;
            console.log(`    ${chave}: ${valor}`);
        }
    }
}
