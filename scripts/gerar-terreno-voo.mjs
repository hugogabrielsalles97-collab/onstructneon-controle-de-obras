/**
 * Gera o terreno do voo: relevo da nuvem de pontos + ortofoto, fatiados em
 * tiles que o Viewer monta direto sobre a modelagem.
 *
 * Por que nao passa pela APS: o Model Derivative nao traduz nuvem de ponto —
 * o proprio NWD traduzido carrega o aviso Navisworks-PointUnsupported, e os
 * DWGs da nuvem falharam na traducao. O caminho e alimentar a camada de
 * terreno do viewer, que ja monta malha georreferenciada em UTM.
 *
 * A nuvem ja vem nas coordenadas do projeto (UTM 23S / SAD69, northing
 * truncado em 7.000.000), entao o relevo encaixa sem reprojecao. A ortofoto
 * vem em WGS 84 / UTM 23S (EPSG:32723) e precisa da transformacao de datum —
 * cerca de 64 m — feita aqui, uma vez, e nao em tempo de render.
 *
 * Uso:
 *   node scripts/gerar-terreno-voo.mjs --dsm <dsm.bin> --meta <dsm.json> --ortho <result.tif>
 *
 * O DSM vem de scripts/extrair-nuvem-dwg.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (nome, padrao) => {
    const i = process.argv.indexOf(`--${nome}`);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};

const DSM_BIN = arg('dsm');
const DSM_META = arg('meta');
const ORTHO = arg('ortho');
const SAIDA = arg('saida', 'public/terreno-voo');

if (!DSM_BIN || !DSM_META || !ORTHO) {
    console.error('Faltam --dsm, --meta ou --ortho. Veja o cabecalho do arquivo.');
    process.exit(1);
}

// --- Geodesia: UTM 23S entre SAD69 e WGS84/SIRGAS -------------------------

const ELIPSOIDE_WGS = { a: 6378137, ecc: 0.006694379990141316 };
const ELIPSOIDE_SAD69 = { a: 6378160, ecc: 2 / 298.25 - 1 / 298.25 ** 2 };
const TRANSLACAO_SAD69_WGS = { x: -67.35, y: 3.88, z: -38.22 };
const ZONA = 23, K0 = 0.9996;

function utmParaGeo(E, N, el) {
    const { a, ecc } = el;
    const eL = ecc / (1 - ecc);
    const e1 = (1 - Math.sqrt(1 - ecc)) / (1 + Math.sqrt(1 - ecc));
    const x = E - 500000, y = N - 10000000, m = y / K0;
    const mu = m / (a * (1 - ecc / 4 - 3 * ecc ** 2 / 64 - 5 * ecc ** 3 / 256));
    const p = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const n1 = a / Math.sqrt(1 - ecc * Math.sin(p) ** 2);
    const t1 = Math.tan(p) ** 2, c1 = eL * Math.cos(p) ** 2;
    const r1 = a * (1 - ecc) / (1 - ecc * Math.sin(p) ** 2) ** 1.5;
    const d = x / (n1 * K0);
    const lat = p - (n1 * Math.tan(p) / r1) * (d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eL) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eL - 3 * c1 ** 2) * d ** 6 / 720);
    const lon0 = (ZONA - 1) * 6 - 180 + 3;
    const lon = (d - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eL + 24 * t1 ** 2) * d ** 5 / 120) / Math.cos(p);
    return { lat: lat * 180 / Math.PI, lon: lon0 + lon * 180 / Math.PI };
}

function geoParaUtm(lat, lon, el) {
    const { a, ecc } = el;
    const eL = ecc / (1 - ecc);
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    const lo0 = ((ZONA - 1) * 6 - 180 + 3) * Math.PI / 180;
    const sin = Math.sin(la), cos = Math.cos(la), tan = Math.tan(la);
    const n = a / Math.sqrt(1 - ecc * sin ** 2);
    const t = tan ** 2, c = eL * cos ** 2, aa = cos * (lo - lo0);
    const m = a * ((1 - ecc / 4 - 3 * ecc ** 2 / 64 - 5 * ecc ** 3 / 256) * la
        - (3 * ecc / 8 + 3 * ecc ** 2 / 32 + 45 * ecc ** 3 / 1024) * Math.sin(2 * la)
        + (15 * ecc ** 2 / 256 + 45 * ecc ** 3 / 1024) * Math.sin(4 * la)
        - (35 * ecc ** 3 / 3072) * Math.sin(6 * la));
    const E = 500000 + K0 * n * (aa + (1 - t + c) * aa ** 3 / 6
        + (5 - 18 * t + t ** 2 + 72 * c - 58 * eL) * aa ** 5 / 120);
    let N = K0 * (m + n * tan * (aa ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24
        + (61 - 58 * t + t ** 2 + 600 * c - 330 * eL) * aa ** 6 / 720));
    if (lat < 0) N += 10000000;
    return { E, N };
}

const geoParaEcef = (lat, lon, el) => {
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    const n = el.a / Math.sqrt(1 - el.ecc * Math.sin(la) ** 2);
    return { x: n * Math.cos(la) * Math.cos(lo), y: n * Math.cos(la) * Math.sin(lo), z: n * (1 - el.ecc) * Math.sin(la) };
};
const ecefParaGeo = (x, y, z, el) => {
    const lon = Math.atan2(y, x), p = Math.hypot(x, y);
    let lat = Math.atan2(z, p * (1 - el.ecc));
    for (let i = 0; i < 8; i++) {
        const n = el.a / Math.sqrt(1 - el.ecc * Math.sin(lat) ** 2);
        const h = p / Math.cos(lat) - n;
        lat = Math.atan2(z, p * (1 - el.ecc * n / (n + h)));
    }
    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
};

/** Coordenada UTM do projeto (SAD69) -> UTM da ortofoto (WGS84). */
function sad69ParaWgs84Utm(E, N) {
    const g = utmParaGeo(E, N, ELIPSOIDE_SAD69);
    const e = geoParaEcef(g.lat, g.lon, ELIPSOIDE_SAD69);
    const w = ecefParaGeo(e.x + TRANSLACAO_SAD69_WGS.x, e.y + TRANSLACAO_SAD69_WGS.y, e.z + TRANSLACAO_SAD69_WGS.z, ELIPSOIDE_WGS);
    return geoParaUtm(w.lat, w.lon, ELIPSOIDE_WGS);
}

// --- Entrada ---------------------------------------------------------------

const meta = JSON.parse(fs.readFileSync(DSM_META, 'utf8'));
const bruto = fs.readFileSync(DSM_BIN);
const dsm = new Float32Array(bruto.buffer, bruto.byteOffset, bruto.length / 4);
const TRUNC = 7000000;

const tif = await sharp(ORTHO, { limitInputPixels: false, unlimited: true }).metadata();
const ESCALA_ORTO = 0.0671;
const ORTO_E0 = 618449.637, ORTO_N0 = 7495022.9174;
console.log(`ortofoto ${tif.width}x${tif.height} a ${ESCALA_ORTO} m/px`);

// --- Grade de tiles em coordenadas do projeto ------------------------------

const TILE_M = 1024;          // lado do tile, em metros
const TEX = 2048;             // pixels de textura por tile -> 0,5 m/px
const ELEV = 256;             // segmentos de relevo por tile -> 4 m
const X0 = Math.floor(meta.x0 / TILE_M) * TILE_M;
const Y0 = Math.floor(meta.y0 / TILE_M) * TILE_M;
const COLS = Math.ceil((meta.x0 + meta.largura * meta.celula - X0) / TILE_M);
const LINS = Math.ceil((meta.y0 + meta.altura * meta.celula - Y0) / TILE_M);
console.log(`grade ${COLS}x${LINS} tiles de ${TILE_M} m a partir de (${X0}, ${Y0})`);

// O deslocamento de datum varia pouco na area: confere nos cantos.
const cantos = [[X0, Y0], [X0 + COLS * TILE_M, Y0], [X0, Y0 + LINS * TILE_M], [X0 + COLS * TILE_M, Y0 + LINS * TILE_M]]
    .map(([E, N]) => { const w = sad69ParaWgs84Utm(E, N + TRUNC); return { dE: w.E - E, dN: w.N - (N + TRUNC) }; });
const dEmin = Math.min(...cantos.map(c => c.dE)), dEmax = Math.max(...cantos.map(c => c.dE));
const dNmin = Math.min(...cantos.map(c => c.dN)), dNmax = Math.max(...cantos.map(c => c.dN));
console.log(`datum SAD69->WGS84: dE ${dEmin.toFixed(2)}..${dEmax.toFixed(2)} m | dN ${dNmin.toFixed(2)}..${dNmax.toFixed(2)} m`);
console.log(`variacao na area: ${(dEmax - dEmin).toFixed(3)} m em E, ${(dNmax - dNmin).toFixed(3)} m em N`);

// --- Ortofoto reamostrada de uma vez --------------------------------------

const ALVO_MPX = TILE_M / TEX;                    // 0,5 m/px
const largRed = Math.round(tif.width * ESCALA_ORTO / ALVO_MPX);
console.log(`reamostrando ortofoto -> ${largRed}px ...`);
const t0 = Date.now();
const { data: orto, info: infoOrto } = await sharp(ORTHO, { limitInputPixels: false, unlimited: true })
    .resize({ width: largRed, kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
const M_ORTO = tif.width * ESCALA_ORTO / infoOrto.width;
console.log(`  ${infoOrto.width}x${infoOrto.height}, ${M_ORTO.toFixed(4)} m/px, ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// --- Geracao ---------------------------------------------------------------

fs.mkdirSync(SAIDA, { recursive: true });
for (const f of fs.readdirSync(SAIDA)) fs.unlinkSync(path.join(SAIDA, f));

const Z_BASE = Math.floor(meta.zmin) - 1;
const tiles = [];
let bytesTex = 0, bytesElev = 0;

const dsmEm = (E, N) => {
    const cx = Math.round((E - meta.x0) / meta.celula);
    const cy = Math.round((N - meta.y0) / meta.celula);
    if (cx < 0 || cy < 0 || cx >= meta.largura || cy >= meta.altura) return NaN;
    return dsm[cy * meta.largura + cx];
};

/** Media das celulas validas num raio, para tapar buracos pequenos do DSM. */
function amostrarRelevo(E, N) {
    const direto = dsmEm(E, N);
    if (Number.isFinite(direto)) return direto;
    let s = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const v = dsmEm(E + dx * meta.celula, N + dy * meta.celula);
        if (Number.isFinite(v)) { s += v; n++; }
    }
    return n >= 4 ? s / n : NaN;
}

for (let j = 0; j < LINS; j++) {
    for (let i = 0; i < COLS; i++) {
        const eOeste = X0 + i * TILE_M;
        const nSul = Y0 + j * TILE_M;

        // --- relevo: (ELEV+1)^2 vertices, bordas compartilhadas com o vizinho
        const lado = ELEV + 1;
        const elevRgb = Buffer.alloc(lado * lado * 3);
        let comRelevo = 0;
        for (let ly = 0; ly < lado; ly++) {
            // linha 0 do PNG e o norte do tile
            const N = nSul + TILE_M * (1 - ly / ELEV);
            for (let lx = 0; lx < lado; lx++) {
                const E = eOeste + TILE_M * (lx / ELEV);
                const z = amostrarRelevo(E, N);
                const d = (ly * lado + lx) * 3;
                if (!Number.isFinite(z)) continue;       // 0,0,0 = sem dado
                const cod = Math.round((z - Z_BASE) * 100) + 1;
                elevRgb[d] = (cod >> 16) & 255;
                elevRgb[d + 1] = (cod >> 8) & 255;
                elevRgb[d + 2] = cod & 255;
                comRelevo++;
            }
        }
        if (comRelevo === 0) continue;                   // tile fora do voo

        // --- textura: recorta a ortofoto ja reamostrada, com o datum aplicado
        const tex = Buffer.alloc(TEX * TEX * 4);
        let comTextura = 0;
        for (let ty = 0; ty < TEX; ty++) {
            const N = nSul + TILE_M * (1 - (ty + 0.5) / TEX);
            for (let tx = 0; tx < TEX; tx++) {
                const E = eOeste + TILE_M * ((tx + 0.5) / TEX);
                const w = sad69ParaWgs84Utm(E, N + TRUNC);
                const sx = Math.round((w.E - ORTO_E0) / M_ORTO - 0.5);
                const sy = Math.round((ORTO_N0 - w.N) / M_ORTO - 0.5);
                if (sx < 0 || sy < 0 || sx >= infoOrto.width || sy >= infoOrto.height) continue;
                const s = (sy * infoOrto.width + sx) * 4;
                if (orto[s + 3] < 128) continue;
                const d = (ty * TEX + tx) * 4;
                tex[d] = orto[s]; tex[d + 1] = orto[s + 1]; tex[d + 2] = orto[s + 2]; tex[d + 3] = 255;
                comTextura++;
            }
        }

        const nomeE = `e_${i}_${j}.png`, nomeT = `t_${i}_${j}.webp`;
        const pngElev = await sharp(elevRgb, { raw: { width: lado, height: lado, channels: 3 } })
            .png({ compressionLevel: 9, palette: false }).toBuffer();
        fs.writeFileSync(path.join(SAIDA, nomeE), pngElev);

        const webp = await sharp(tex, { raw: { width: TEX, height: TEX, channels: 4 } })
            .webp({ quality: 82, alphaQuality: 100, effort: 4 }).toBuffer();
        fs.writeFileSync(path.join(SAIDA, nomeT), webp);

        bytesElev += pngElev.length; bytesTex += webp.length;
        tiles.push({ i, j, relevo: nomeE, textura: nomeT });
        console.log(`  tile ${i},${j}: relevo ${(comRelevo / (lado * lado) * 100).toFixed(0)}%, `
            + `textura ${(comTextura / (TEX * TEX) * 100).toFixed(0)}% — `
            + `${(pngElev.length / 1024).toFixed(0)} KB + ${(webp.length / 1024).toFixed(0)} KB`);
    }
}

const manifesto = {
    gerado: new Date().toISOString(),
    // Canto sudoeste da grade, em UTM 23S do projeto. Northing ja completo,
    // para o viewer comparar direto com a referencia que ele extrai do modelo.
    easting: X0,
    northing: Y0 + TRUNC,
    datum: 'sad69',
    zona: ZONA,
    tileMetros: TILE_M,
    colunas: COLS,
    linhas: LINS,
    segmentos: ELEV,
    // elevacao = zBase + (R*65536 + G*256 + B - 1) / 100 ; zero = sem dado
    zBase: Z_BASE,
    escalaZ: 0.01,
    tiles,
};
fs.writeFileSync(path.join(SAIDA, 'manifesto.json'), JSON.stringify(manifesto, null, 2));

console.log('');
console.log(`${tiles.length} tiles gravados em ${SAIDA}`);
console.log(`relevo ${(bytesElev / 1048576).toFixed(1)} MB + textura ${(bytesTex / 1048576).toFixed(1)} MB`);
