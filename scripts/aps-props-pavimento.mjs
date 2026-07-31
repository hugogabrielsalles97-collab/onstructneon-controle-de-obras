/**
 * Levanta as propriedades CCR das peças de pavimento.
 *
 *   node --env-file=.env scripts/aps-props-pavimento.mjs [amostrasPorCamada]
 *
 * O projeto grava em cada peça o seu estaqueamento e a localização da obra.
 * Isso vale mais que qualquer inferência geométrica: em vez de descobrir a
 * estaca projetando pontos no eixo, dá para ler o que o projetista escreveu.
 *
 * Só lê. Salva o resultado em scripts/.props-pavimento.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, requireCredentials, REGION } from './aps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESTADO = join(__dirname, '.aps-state.json');
const ARVORE = join(__dirname, '.aps-tree.json');
const SAIDA = join(__dirname, '.props-pavimento.json');

const CAMADAS = ['CFT', 'M_SECO', 'BGTC', 'BGMC', 'CAUQ'];
const POR_CAMADA = Number(process.argv[2] || 25);
const CONCORRENCIA = 4;

requireCredentials();

for (const arquivo of [ESTADO, ARVORE]) {
    if (!existsSync(arquivo)) { console.error(`Faltando ${arquivo}.`); process.exit(1); }
}

const { urn } = JSON.parse(readFileSync(ESTADO, 'utf8'));
const tree = JSON.parse(readFileSync(ARVORE, 'utf8'));

// Junta folhas de cada camada de pavimento, espalhadas ao longo da lista para
// a amostra cobrir trechos diferentes e não só o começo.
const alvos = [];

const percorrer = (no, camada = null) => {
    const atual = CAMADAS.includes(no.name) ? no.name : camada;
    if (atual && (!no.objects || no.objects.length === 0)) alvos.push({ objectid: no.objectid, camada: atual });
    for (const filho of no.objects || []) percorrer(filho, atual);
};
percorrer(tree.data.objects[0]);

const porCamada = new Map();
for (const a of alvos) {
    if (!porCamada.has(a.camada)) porCamada.set(a.camada, []);
    porCamada.get(a.camada).push(a.objectid);
}

const amostra = [];
for (const [camada, ids] of porCamada) {
    const passo = Math.max(1, Math.floor(ids.length / POR_CAMADA));
    for (let i = 0; i < ids.length && amostra.filter(a => a.camada === camada).length < POR_CAMADA; i += passo) {
        amostra.push({ camada, objectid: ids[i] });
    }
}

console.log(`${alvos.length} peça(s) de pavimento na árvore; amostrando ${amostra.length}.\n`);

const meta = await api(`/modelderivative/v2/designdata/${urn}/metadata`, {
    headers: { 'x-ads-region': REGION },
    scopes: 'data:read viewables:read',
});
const guid = meta.data.metadata[0].guid;

const resultados = [];
let cursor = 0;
let feitos = 0;

const trabalhador = async () => {
    while (cursor < amostra.length) {
        const item = amostra[cursor++];

        try {
            const resposta = await api(
                `/modelderivative/v2/designdata/${urn}/metadata/${guid}/properties?objectid=${item.objectid}&forceget=true`,
                { headers: { 'x-ads-region': REGION }, scopes: 'data:read viewables:read' }
            );

            const props = resposta?.data?.collection?.[0]?.properties || {};
            const info = props['B_Info Objetos'] || {};

            resultados.push({
                objectid: item.objectid,
                camada: item.camada,
                cod: info['CCR_Cod'] ?? null,
                disciplina: info['CCR_Disciplina'] ?? null,
                localizacao: info['CCR_LocalizacaoObra'] ?? null,
                estacaInicial: info['CCR_EstaqueamentoInicial'] ?? null,
                estacaFinal: info['CCR_EstaqueamentoFinal'] ?? null,
                situacao: info['CCR_Situacao'] ?? null,
            });
        } catch (err) {
            resultados.push({ objectid: item.objectid, camada: item.camada, erro: String(err.message).slice(0, 80) });
        }

        feitos++;
        if (feitos % 25 === 0) console.log(`  ${feitos}/${amostra.length}`);
    }
};

await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));

writeFileSync(SAIDA, JSON.stringify(resultados, null, 2));

const comProps = resultados.filter(r => r.localizacao || r.estacaInicial);
console.log(`\n${comProps.length}/${resultados.length} peça(s) com propriedades CCR preenchidas.\n`);

const locais = new Map();
for (const r of comProps) {
    const chave = r.localizacao || '(sem localizacao)';
    if (!locais.has(chave)) locais.set(chave, []);
    locais.get(chave).push(r);
}

console.log('--- CCR_LocalizacaoObra ---');
for (const [local, lista] of [...locais.entries()].sort()) {
    const faixas = lista
        .filter(r => r.estacaInicial && r.estacaFinal)
        .map(r => `${r.estacaInicial}→${r.estacaFinal}`);
    const exemplos = [...new Set(faixas)].slice(0, 3).join(', ');
    console.log(`  ${String(local).padEnd(16)} ${String(lista.length).padStart(4)} peça(s)  ex.: ${exemplos}`);
}

console.log('\n--- CCR_Cod por camada ---');
const cods = new Map();
for (const r of comProps) {
    const chave = `${r.camada} → ${r.cod}`;
    cods.set(chave, (cods.get(chave) || 0) + 1);
}
for (const [chave, n] of [...cods.entries()].sort()) console.log(`  ${chave}: ${n}`);

console.log(`\nsalvo em ${SAIDA}`);
