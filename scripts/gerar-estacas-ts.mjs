/**
 * Converte scripts/.estacas.json no módulo que o app usa.
 *
 *   node scripts/gerar-estacas-ts.mjs
 *
 * Guarda o objectid de cada rótulo de propósito: no navegador, a posição vem
 * da caixa envolvente do próprio elemento no Viewer, e não da coordenada UTM.
 * Assim não é preciso descobrir o deslocamento entre o sistema do CAD e o do
 * Viewer — um erro ali colocaria o serviço na estaca errada.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRADA = join(__dirname, '.estacas.json');
const SAIDA = join(__dirname, '..', 'utils', 'estacasModelo.ts');

if (!existsSync(ENTRADA)) {
    console.error('Rode antes: node --env-file=.env scripts/aps-estacas.mjs');
    process.exit(1);
}

const { estacas } = JSON.parse(readFileSync(ENTRADA, 'utf8'));

// Só os rótulos de 5 dígitos: são os que usam a mesma numeração das tarefas.
// Os rótulos curtos (0, 5, 13) pertencem a eixos auxiliares e não têm
// correspondência no ELOS.
const validas = estacas
    .filter(e => /^\d{5}$/.test(e.rotulo))
    .map(e => ({ objectid: e.objectid, estaca: Number(e.rotulo) }))
    .sort((a, b) => a.estaca - b.estaca);

const eixos = new Map();
for (const e of validas) {
    const eixo = Math.floor(e.estaca / 10000);
    if (!eixos.has(eixo)) eixos.set(eixo, []);
    eixos.get(eixo).push(e.estaca);
}

const conteudo = `/**
 * Rótulos de estaca do modelo federado, na mesma numeração usada pelas
 * tarefas do ELOS.
 *
 * Gerado por scripts/gerar-estacas-ts.mjs — não editar à mão.
 *
 * \`objectid\` é o dbId do rótulo no Viewer. A posição de cada estaca é lida
 * da caixa envolvente desse elemento em tempo de execução, evitando qualquer
 * conversão entre o sistema de coordenadas do CAD e o do Viewer.
 */

export interface EstacaModelo {
    objectid: number;
    estaca: number;
}

export const ESTACAS_MODELO: EstacaModelo[] = ${JSON.stringify(validas)};

/** Eixo de uma estaca: o primeiro dígito do rótulo de 5 posições. */
export const eixoDaEstaca = (estaca: number): number => Math.floor(estaca / 10000);
`;

writeFileSync(SAIDA, conteudo);

console.log(`${validas.length} estaca(s) gravadas em utils/estacasModelo.ts`);
for (const [eixo, lista] of [...eixos.entries()].sort()) {
    console.log(`  eixo ${eixo}: ${lista.length} rótulo(s), de ${Math.min(...lista)} a ${Math.max(...lista)}`);
}
