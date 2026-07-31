/**
 * Resume o que existe dentro de cada arquivo de origem do federado, agrupando
 * os nomes das folhas por tipo.
 *
 *   node --env-file=.env scripts/aps-conteudo.mjs [filtro]
 *
 * Serve para responder "que elemento é esse?" sem abrir o Navisworks.
 * Só lê o arquivo de árvore já baixado por aps-tree.mjs.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARVORE = join(__dirname, '.aps-tree.json');

if (!existsSync(ARVORE)) {
    console.error('Rode antes: node --env-file=.env scripts/aps-tree.mjs');
    process.exit(1);
}

const filtro = (process.argv[2] || '').toLowerCase();
const tree = JSON.parse(readFileSync(ARVORE, 'utf8'));
const raiz = tree.data.objects[0];

/** Normaliza para agrupar: tira numeração, estaca e sufixo de instância. */
const tipoDe = (nome) =>
    String(nome)
        .replace(/[\d]+[\.,+]?[\d]*/g, '#')
        .replace(/\s+/g, ' ')
        .trim();

const folhas = (no, saida) => {
    if (!no.objects || no.objects.length === 0) { saida.push(no.name); return; }
    for (const filho of no.objects) folhas(filho, saida);
};

for (const arquivo of raiz.objects) {
    if (filtro && !arquivo.name.toLowerCase().includes(filtro)) continue;

    const nomes = [];
    folhas(arquivo, nomes);

    const grupos = new Map();
    for (const n of nomes) {
        const t = tipoDe(n);
        grupos.set(t, (grupos.get(t) || 0) + 1);
    }

    const todos = process.argv.includes('--todos');
    const ordenados = [...grupos.entries()].sort((a, b) => b[1] - a[1]);
    const top = todos ? ordenados : ordenados.slice(0, 10);

    console.log(`\n=== ${arquivo.name} — ${nomes.length} elemento(s) ===`);
    for (const [tipo, qtd] of top) console.log(`  ${String(qtd).padStart(6)}x  ${tipo}`);
    if (grupos.size > top.length) console.log(`  ... e mais ${grupos.size - top.length} tipo(s)`);
}
