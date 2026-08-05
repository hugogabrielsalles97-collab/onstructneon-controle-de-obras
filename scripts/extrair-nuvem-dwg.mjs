/**
 * Extrai a nuvem de pontos dos DWGs do voo e grade num DSM.
 *
 * Os pontos vem como entidades POINT do AutoCAD, ja nas coordenadas do
 * federado (UTM 23S / SAD69 com northing truncado), entao nao ha reprojecao:
 * o que sair daqui encaixa no modelo por construcao.
 *
 * Grada direto durante o streaming — guardar milhoes de pontos em memoria so
 * para depois gradar seria desperdicio.
 *
 * Uso:
 *   node scripts/extrair-nuvem-dwg.mjs --dwgs <pasta> --saida <pasta>
 *
 * Escreve dsm.bin (Float32, NaN onde nao houve levantamento) e dsm.json, que
 * alimentam scripts/gerar-terreno-voo.mjs.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (nome, padrao) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};

/** Pasta com os DWGs e com o libredwg (dwgread.exe). */
const PASTA = arg('dwgs');
const DWGREAD = arg('dwgread', PASTA && path.join(PASTA, 'libredwg-0.14-win64', 'dwgread.exe'));
const SAIDA = arg('saida', '.');
const ARQUIVOS = arg('arquivos', '1_local,2_local,3_local,4_local,4-5_local,5_local,6_local').split(',');
const CELULA = Number(arg('celula', '1'));

if (!PASTA) {
    console.error('Falta --dwgs <pasta com os DWGs>. Veja o cabecalho do arquivo.');
    process.exit(1);
}

// Extensao combinada dos sete DWGs da Serra das Araras, com folga de 5 m.
// Trocar quando o levantamento mudar de area.
const X0 = Number(arg('x0', '618795')), Y0 = Number(arg('y0', '491240'));
const X1 = Number(arg('x1', '622165')), Y1 = Number(arg('y1', '494825'));
const LARG = Math.ceil((X1 - X0) / CELULA);
const ALT = Math.ceil((Y1 - Y0) / CELULA);

const soma = new Float64Array(LARG * ALT);
const cont = new Uint16Array(LARG * ALT);
const MARCA = '"_subclass":"AcDbPoint","x":';

let totalGeral = 0;

/** Le tres numeros separados por rotulos a partir de uma posicao. */
function lerPonto(t, i) {
    const fimX = t.indexOf(',"y":', i);
    if (fimX < 0) return null;
    const fimY = t.indexOf(',"z":', fimX + 5);
    if (fimY < 0) return null;
    let fimZ = fimY + 5;
    while (fimZ < t.length && t[fimZ] !== ',' && t[fimZ] !== '}') fimZ++;
    if (fimZ >= t.length) return null;
    return {
        x: +t.slice(i, fimX),
        y: +t.slice(fimX + 5, fimY),
        z: +t.slice(fimY + 5, fimZ),
        fim: fimZ,
    };
}

function processar(nome) {
    return new Promise((resolve, reject) => {
        const p = spawn(DWGREAD, ['-O', 'minJSON', `${nome}.dwg`], { cwd: PASTA });
        let resto = '';
        let n = 0, fora = 0;

        p.stdout.setEncoding('latin1');
        p.stdout.on('data', (c) => {
            const t = resto + c;
            let i = 0, ultimo = 0;
            for (;;) {
                const j = t.indexOf(MARCA, i);
                if (j < 0) break;
                const p3 = lerPonto(t, j + MARCA.length);
                // Registro cortado no limite do bloco: reprocessa no proximo.
                if (!p3) break;
                i = p3.fim;
                ultimo = p3.fim;
                if (p3.z === 0 || !Number.isFinite(p3.x) || !Number.isFinite(p3.y) || !Number.isFinite(p3.z)) continue;
                const cx = Math.floor((p3.x - X0) / CELULA);
                const cy = Math.floor((p3.y - Y0) / CELULA);
                if (cx < 0 || cy < 0 || cx >= LARG || cy >= ALT) { fora++; continue; }
                const k = cy * LARG + cx;
                if (cont[k] < 65535) { soma[k] += p3.z; cont[k]++; }
                n++;
            }
            resto = t.slice(Math.max(ultimo, t.length - 512));
        });

        p.stderr.on('data', () => { /* progresso do dwgread, ignorado */ });
        p.on('error', reject);
        p.on('close', () => {
            totalGeral += n;
            console.log(`${nome}: ${n.toLocaleString('pt-BR')} pontos gradados${fora ? `, ${fora} fora da area` : ''}`);
            resolve();
        });
    });
}

for (const nome of ARQUIVOS) await processar(nome);

let preenchidas = 0, zmin = Infinity, zmax = -Infinity;
const dsm = new Float32Array(LARG * ALT);
for (let k = 0; k < dsm.length; k++) {
    if (cont[k] === 0) { dsm[k] = NaN; continue; }
    const z = soma[k] / cont[k];
    dsm[k] = z;
    preenchidas++;
    if (z < zmin) zmin = z;
    if (z > zmax) zmax = z;
}

fs.writeFileSync(path.join(SAIDA, 'dsm.bin'), Buffer.from(dsm.buffer));
fs.writeFileSync(path.join(SAIDA, 'dsm.json'), JSON.stringify({
    x0: X0, y0: Y0, celula: CELULA, largura: LARG, altura: ALT,
    pontos: totalGeral, celulasPreenchidas: preenchidas,
    cobertura: preenchidas / (LARG * ALT), zmin, zmax,
}, null, 2));

console.log('');
console.log(`total: ${totalGeral.toLocaleString('pt-BR')} pontos`);
console.log(`grade: ${LARG} x ${ALT} celulas de ${CELULA} m`);
console.log(`preenchidas: ${preenchidas.toLocaleString('pt-BR')} (${(preenchidas / (LARG * ALT) * 100).toFixed(1)}%)`);
console.log(`cota: ${zmin.toFixed(1)} a ${zmax.toFixed(1)} m`);
