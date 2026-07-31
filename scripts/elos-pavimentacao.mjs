/**
 * Levanta como o ELOS guarda as tarefas de pavimentação: quais serviços
 * existem, onde a estaca aparece e em que formato.
 *
 *   node --env-file=.env scripts/elos-pavimentacao.mjs
 *
 * Só lê. Serve de base para ligar o modelo 3D ao avanço real da obra.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const parseEstacaRange = (value) => {
    if (!value) return null;
    const nums = (String(value).match(/\d{5,6}/g) || []).map(Number).filter(n => !Number.isNaN(n));
    if (nums.length === 0) return null;
    if (nums.length === 1) return [nums[0], nums[0]];
    return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
};

const tarefas = [];
let offset = 0;

while (true) {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, discipline, location, corte, side, status, progress, quantity, unit, actualEndDate')
        .order('id', { ascending: true })
        .range(offset, offset + 499);

    if (error) throw error;
    if (!data || data.length === 0) break;

    tarefas.push(...data);
    offset += 500;
}

console.log(`${tarefas.length} tarefa(s) no total.\n`);

const disciplinas = new Map();
for (const t of tarefas) disciplinas.set(t.discipline, (disciplinas.get(t.discipline) || 0) + 1);

console.log('--- disciplinas ---');
for (const [d, n] of [...disciplinas.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${d}`);
}

const pav = tarefas.filter(t => /paviment/i.test(t.discipline || ''));
console.log(`\n--- pavimentação: ${pav.length} tarefa(s) ---`);

const servicos = new Map();
for (const t of pav) servicos.set(t.title, (servicos.get(t.title) || 0) + 1);

console.log('\nserviços (title):');
for (const [s, n] of [...servicos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${s}`);
}

// Onde a estaca realmente mora
let comLocation = 0, comCorte = 0, semEstaca = 0;
const faixas = [];

for (const t of pav) {
    const porLocation = parseEstacaRange(t.location);
    const porCorte = parseEstacaRange(t.corte);

    if (porLocation) comLocation++;
    if (porCorte) comCorte++;
    if (!porLocation && !porCorte) semEstaca++;

    const faixa = porLocation || porCorte;
    if (faixa) faixas.push(faixa);
}

console.log(`\nestaca em location: ${comLocation}`);
console.log(`estaca em corte   : ${comCorte}`);
console.log(`sem estaca        : ${semEstaca}`);

if (faixas.length) {
    const min = Math.min(...faixas.map(f => f[0]));
    const max = Math.max(...faixas.map(f => f[1]));
    console.log(`\nfaixa de estacas: ${min} a ${max}`);

    const prefixos = new Map();
    for (const f of faixas) {
        const p = String(f[0]).slice(0, 1);
        prefixos.set(p, (prefixos.get(p) || 0) + 1);
    }
    console.log('primeiro dígito (eixo?):');
    for (const [p, n] of [...prefixos.entries()].sort()) console.log(`  ${p}: ${n} faixa(s)`);
}

console.log('\n--- amostra ---');
for (const t of pav.slice(0, 12)) {
    const faixa = parseEstacaRange(t.location) || parseEstacaRange(t.corte);
    console.log(`  [${t.status}] ${t.title}`);
    console.log(`     location="${t.location}" corte="${t.corte}" lado=${t.side} avanco=${t.progress}%`);
    console.log(`     estacas: ${faixa ? faixa.join(' a ') : '—'}`);
}
