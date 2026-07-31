/**
 * Cruza as faixas de estaca das tarefas com a extensão estaqueada do modelo,
 * mostrando quanto de cada eixo deveria aparecer pintado e onde ficam os vãos.
 *
 *   node --env-file=.env scripts/elos-cobertura-estacas.mjs
 *
 * Só lê. Serve para distinguir "a pintura falhou" de "não há tarefa ali".
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESTACAS = join(__dirname, '.estacas.json');

if (!existsSync(ESTACAS)) { console.error('Rode antes: scripts/aps-estacas.mjs'); process.exit(1); }

const supabase = createClient(
    process.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
    { auth: { persistSession: false } }
);

const extrairFaixa = (texto) => {
    if (!texto) return null;
    const nums = (String(texto).match(/\d{5,6}/g) || []).map(Number).filter(Number.isFinite);
    if (nums.length === 0) return null;
    if (nums.length === 1) return [nums[0], nums[0]];
    return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
};

const servicoDoTitulo = (t) => {
    const s = (t || '').toUpperCase();
    if (s.includes('CBUQ') || s.includes('CAUQ')) return 'CBUQ';
    if (s.includes('BGTC')) return 'BGTC';
    if (s.includes('BGMC')) return 'BGMC';
    if (s.includes('MACADAME')) return 'Macadame';
    if (s.includes('CFT')) return 'CFT';
    return null;
};

const tarefas = [];
let offset = 0;
while (true) {
    const { data, error } = await supabase
        .from('tasks')
        .select('title, discipline, location, corte, status, progress')
        .order('id', { ascending: true })
        .range(offset, offset + 499);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const t of data) {
        if (!/paviment/i.test(t.discipline || '')) continue;
        const servico = servicoDoTitulo(t.title);
        if (!servico) continue;

        const fontes = [extrairFaixa(t.title), extrairFaixa(t.location), extrairFaixa(t.corte)].filter(Boolean);
        if (fontes.length === 0) continue;

        // Regra antiga: só location, senão corte.
        const antiga = extrairFaixa(t.location) || extrairFaixa(t.corte);
        // Regra nova: união dos três campos.
        const nova = [Math.min(...fontes.map(f => f[0])), Math.max(...fontes.map(f => f[1]))];

        tarefas.push({
            servico,
            de: nova[0],
            ate: nova[1],
            antigaDe: antiga ? antiga[0] : nova[0],
            antigaAte: antiga ? antiga[1] : nova[1],
            divergente: fontes.some(f => f[0] !== nova[0] || f[1] !== nova[1]),
            status: t.status,
            progresso: Number(t.progress) || 0,
        });
    }
    offset += 500;
}

const { estacas } = JSON.parse(readFileSync(ESTACAS, 'utf8'));
const rotulos = estacas.filter(e => /^\d{5}$/.test(e.rotulo)).map(e => Number(e.rotulo));

const eixos = new Map();
for (const r of rotulos) {
    const eixo = Math.floor(r / 10000);
    if (!eixos.has(eixo)) eixos.set(eixo, []);
    eixos.get(eixo).push(r);
}

const divergentes = tarefas.filter(t => t.divergente);
console.log(`${tarefas.length} tarefa(s) de pavimentação com faixa legível.`);
console.log(`${divergentes.length} com campos discordantes entre título, local e corte.\n`);

for (const t of divergentes.slice(0, 12)) {
    console.log(`  ${t.servico}: antes ${t.antigaDe}-${t.antigaAte}, agora ${t.de}-${t.ate}`);
}
console.log('');

for (const [eixo, lista] of [...eixos.entries()].sort()) {
    const min = Math.min(...lista);
    const max = Math.max(...lista);
    const total = max - min + 1;

    const coberto = new Set();
    for (const t of tarefas) {
        for (let e = Math.max(t.de, min); e <= Math.min(t.ate, max); e++) coberto.add(e);
    }

    const concluido = new Set();
    for (const t of tarefas) {
        if (t.status !== 'Concluído' && t.progresso < 100) continue;
        for (let e = Math.max(t.de, min); e <= Math.min(t.ate, max); e++) concluido.add(e);
    }

    console.log(`=== eixo ${eixo}: modelo vai de ${min} a ${max} (${total} estacas) ===`);
    console.log(`  com alguma tarefa : ${coberto.size} estaca(s) (${(coberto.size / total * 100).toFixed(1)}%)`);
    console.log(`  com tarefa conclui: ${concluido.size} estaca(s) (${(concluido.size / total * 100).toFixed(1)}%)`);

    // Trechos contínuos cobertos
    const ordenadas = [...coberto].sort((a, b) => a - b);
    const trechos = [];
    let inicio = null, anterior = null;

    for (const e of ordenadas) {
        if (inicio === null) { inicio = e; anterior = e; continue; }
        if (e === anterior + 1) { anterior = e; continue; }
        trechos.push([inicio, anterior]);
        inicio = e; anterior = e;
    }
    if (inicio !== null) trechos.push([inicio, anterior]);

    console.log(`  trechos com tarefa: ${trechos.map(t => `${t[0]}-${t[1]}`).join(', ') || 'nenhum'}`);
    console.log('');
}
