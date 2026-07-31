/**
 * Analisa a geometria dos dois eixos de estaqueamento.
 *
 *   node scripts/aps-analise-eixos.mjs
 *
 * Serve para saber se dá para distinguir as pistas pela distância até o eixo
 * mais próximo, ou se os rótulos estão perto demais um do outro para isso.
 * Só lê o arquivo já extraído por aps-estacas.mjs.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRADA = join(__dirname, '.estacas.json');

if (!existsSync(ENTRADA)) { console.error('Rode antes: scripts/aps-estacas.mjs'); process.exit(1); }

const { estacas } = JSON.parse(readFileSync(ENTRADA, 'utf8'));
const validas = estacas
    .filter(e => /^\d{5}$/.test(e.rotulo))
    .map(e => ({ estaca: Number(e.rotulo), x: e.x, y: e.y }));

const eixos = new Map();
for (const e of validas) {
    const eixo = Math.floor(e.estaca / 10000);
    if (!eixos.has(eixo)) eixos.set(eixo, []);
    eixos.get(eixo).push(e);
}
for (const lista of eixos.values()) lista.sort((a, b) => a.estaca - b.estaca);

console.log('--- espaçamento entre rótulos consecutivos ---');
for (const [eixo, lista] of [...eixos.entries()].sort()) {
    const passos = [];
    for (let i = 0; i < lista.length - 1; i++) {
        const d = Math.hypot(lista[i + 1].x - lista[i].x, lista[i + 1].y - lista[i].y);
        const deltaEstaca = lista[i + 1].estaca - lista[i].estaca;
        if (deltaEstaca > 0) passos.push({ d, deltaEstaca, metrosPorEstaca: d / deltaEstaca });
    }

    const mpe = passos.map(p => p.metrosPorEstaca).sort((a, b) => a - b);
    const mediana = mpe[Math.floor(mpe.length / 2)];

    console.log(`eixo ${eixo}: ${lista.length} rótulos, ${mpe.length} intervalos`);
    console.log(`  metros por estaca (mediana): ${mediana.toFixed(2)} m`);
    console.log(`  mínimo ${mpe[0].toFixed(2)} m, máximo ${mpe[mpe.length - 1].toFixed(2)} m`);

    // Intervalos muito fora do padrão de 20 m denunciam salto de traçado.
    const fora = passos.filter(p => Math.abs(p.metrosPorEstaca - 20) > 5);
    if (fora.length) {
        console.log(`  ${fora.length} intervalo(s) fora do padrão de 20 m/estaca`);
    }
}

// Distância entre os dois eixos
const [a, b] = [...eixos.values()];
if (a && b) {
    const distancias = [];
    for (const p of a) {
        let menor = Infinity;
        for (const q of b) {
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d < menor) menor = d;
        }
        distancias.push(menor);
    }

    distancias.sort((x, y) => x - y);
    console.log('\n--- distância de cada rótulo do eixo 3 ao rótulo mais próximo do eixo 4 ---');
    console.log(`  mínima : ${distancias[0].toFixed(1)} m`);
    console.log(`  mediana: ${distancias[Math.floor(distancias.length / 2)].toFixed(1)} m`);
    console.log(`  máxima : ${distancias[distancias.length - 1].toFixed(1)} m`);
    console.log(`  abaixo de 30 m: ${distancias.filter(d => d < 30).length} rótulo(s)`);
    console.log(`  abaixo de 15 m: ${distancias.filter(d => d < 15).length} rótulo(s)`);
}
