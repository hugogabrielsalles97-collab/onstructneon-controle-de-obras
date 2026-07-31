/**
 * Extrai os rótulos de estaca do modelo, com coordenada e eixo.
 *
 *   node --env-file=.env scripts/aps-estacas.mjs
 *
 * Cada estaca é um MTEXT nas camadas C-HZ-ESTACA / F-HZ-ESTACA: o rótulo está
 * em Text.Conteúdo e a posição em AutoCAD Geometry. O resultado vai para
 * scripts/.estacas.json e é a base para ligar elemento do modelo a tarefa do
 * ELOS, que trabalha por faixa de estacas.
 *
 * Só lê.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, requireCredentials, REGION } from './aps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESTADO = join(__dirname, '.aps-state.json');
const ARVORE = join(__dirname, '.aps-tree.json');
const SAIDA = join(__dirname, '.estacas.json');

const CAMADAS_ESTACA = ['C-HZ-ESTACA', 'F-HZ-ESTACA'];
const CONCORRENCIA = 4;

requireCredentials();

for (const arquivo of [ESTADO, ARVORE]) {
    if (!existsSync(arquivo)) {
        console.error(`Faltando ${arquivo}. Rode aps-upload-translate.mjs e aps-tree.mjs antes.`);
        process.exit(1);
    }
}

const { urn } = JSON.parse(readFileSync(ESTADO, 'utf8'));
const tree = JSON.parse(readFileSync(ARVORE, 'utf8'));

// Junta os MTEXT que estão dentro das camadas de estaca.
const alvos = [];

const percorrer = (no, camadaAtual = null) => {
    const camada = CAMADAS_ESTACA.includes(no.name) ? no.name : camadaAtual;

    if (camada && no.name === 'MTEXT') alvos.push({ objectid: no.objectid, camada });

    for (const filho of no.objects || []) percorrer(filho, camada);
};

percorrer(tree.data.objects[0]);
console.log(`${alvos.length} rótulo(s) de estaca encontrados na árvore.`);

if (alvos.length === 0) {
    console.error('Nenhum MTEXT nas camadas de estaca — a nomenclatura pode ter mudado.');
    process.exit(1);
}

const meta = await api(`/modelderivative/v2/designdata/${urn}/metadata`, {
    headers: { 'x-ads-region': REGION },
    scopes: 'data:read viewables:read',
});
const guid = meta.data.metadata[0].guid;

const estacas = [];
const falhas = [];
let feitos = 0;
let cursor = 0;

const trabalhador = async () => {
    while (cursor < alvos.length) {
        const alvo = alvos[cursor++];

        try {
            const resposta = await api(
                `/modelderivative/v2/designdata/${urn}/metadata/${guid}/properties?objectid=${alvo.objectid}&forceget=true`,
                { headers: { 'x-ads-region': REGION }, scopes: 'data:read viewables:read' }
            );

            const item = resposta?.data?.collection?.[0];
            const texto = item?.properties?.Text?.['Conteúdo'];
            const geo = item?.properties?.['AutoCAD Geometry'] || {};

            const x = parseFloat(String(geo['Posição X'] || '').replace(' m', ''));
            const y = parseFloat(String(geo['Posição Y'] || '').replace(' m', ''));

            if (texto !== undefined && Number.isFinite(x) && Number.isFinite(y)) {
                estacas.push({
                    objectid: alvo.objectid,
                    camada: item?.properties?.General?.Camada || alvo.camada,
                    rotulo: String(texto).trim(),
                    x,
                    y,
                });
            }
        } catch (err) {
            falhas.push(`${alvo.objectid}: ${err.message}`);
        }

        feitos++;
        if (feitos % 100 === 0) console.log(`  ${feitos}/${alvos.length} — ${estacas.length} lido(s)`);
    }
};

await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));

writeFileSync(SAIDA, JSON.stringify({ geradoEm: new Date().toISOString(), estacas }, null, 2));

console.log(`\n${estacas.length} estaca(s) extraída(s), ${falhas.length} falha(s).`);

const porCamada = new Map();
for (const e of estacas) {
    if (!porCamada.has(e.camada)) porCamada.set(e.camada, []);
    porCamada.get(e.camada).push(e);
}

for (const [camada, lista] of porCamada) {
    const numericos = lista.map(e => Number(e.rotulo)).filter(Number.isFinite);
    const faixa = numericos.length ? `${Math.min(...numericos)} a ${Math.max(...numericos)}` : 'não numéricos';
    console.log(`\n${camada}: ${lista.length} rótulo(s), faixa ${faixa}`);
    console.log(`  exemplos: ${lista.slice(0, 8).map(e => e.rotulo).join(', ')}`);
}

if (falhas.length) console.log(`\nfalhas: ${falhas.slice(0, 5).join(' | ')}`);
console.log(`\nsalvo em ${SAIDA}`);
