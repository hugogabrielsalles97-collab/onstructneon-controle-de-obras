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

/**
 * Calibracao da grade cartesiana do BIM contra a grade UTM SAD69.
 *
 * As coordenadas do federado nao sao UTM exato: ha um deslocamento de cerca
 * de 41 m em leste, mais rotacao e escala residuais. Os valores vem do ajuste
 * contra 1.088 pontos COGO cotados do proprio modelo (o mesmo usado em
 * components/viewerTerreno.ts), e foram confirmados de forma independente
 * correlacionando as bordas do relevo da nuvem com as bordas da ortofoto:
 * pico em -39,5 m / +4,0 m, dentro de 1,5 m do ajuste COGO.
 *
 * Sem este passo a ortofoto sai ~40 m a oeste do relevo, porque o relevo vem
 * da nuvem (grade do BIM) e a imagem vem do voo (UTM de verdade).
 */
const CALIBRACAO_GRADE = {
    centroEasting: 620575.3614503667,
    centroNorthing: 7493731.744554228,
    deslocamentoLeste: -40.9951171875,
    deslocamentoNorte: 4.6875,
    anguloRad: 0.010603076384501078 * Math.PI / 180,
    escala: 1 + 7.763671875 / 1_000_000,
};

/** Grade cartesiana do BIM -> grade UTM SAD69. Northing completo nos dois lados. */
function bimParaGradeSad69(E, N) {
    const t = CALIBRACAO_GRADE;
    const x = E - t.centroEasting;
    const y = N - t.centroNorthing;
    const cos = Math.cos(t.anguloRad);
    const sin = Math.sin(t.anguloRad);
    return {
        E: t.centroEasting + t.deslocamentoLeste + t.escala * (cos * x - sin * y),
        N: t.centroNorthing + t.deslocamentoNorte + t.escala * (sin * x + cos * y),
    };
}

/** Coordenada UTM do projeto (SAD69) -> UTM da ortofoto (WGS84). */
function sad69ParaWgs84Utm(E, N) {
    const g = utmParaGeo(E, N, ELIPSOIDE_SAD69);
    const e = geoParaEcef(g.lat, g.lon, ELIPSOIDE_SAD69);
    const w = ecefParaGeo(e.x + TRANSLACAO_SAD69_WGS.x, e.y + TRANSLACAO_SAD69_WGS.y, e.z + TRANSLACAO_SAD69_WGS.z, ELIPSOIDE_WGS);
    return geoParaUtm(w.lat, w.lon, ELIPSOIDE_WGS);
}

/** Coordenada do modelo -> pixel da ortofoto. Grade do BIM, depois datum. */
function bimParaWgs84Utm(E, N) {
    const g = bimParaGradeSad69(E, N);
    return sad69ParaWgs84Utm(g.E, g.N);
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

/**
 * Tile pequeno, textura fina.
 *
 * O voo cobre ~21% da area da grade, mas a memoria de video de um tile e paga
 * inteira mesmo quando so um canto tem imagem — havia tile com 2% de cobertura
 * segurando 16 MB de RGBA. Dobrar a resolucao com tile de 1024 m custaria
 * quatro vezes a memoria; com tile de 256 m a grade acompanha o contorno do
 * voo (87 tiles ocupados de 210, contra 14 de 20) e a conta sobe pouco mais
 * de 50% para quatro vezes mais detalhe.
 *
 * A fonte esta a 0,067 m/px, entao 0,25 m/px ainda e reamostragem para baixo:
 * o limite aqui e memoria, nao o levantamento.
 */
const TILE_M = 256;           // lado do tile, em metros
const TEX = 1024;             // pixels de textura por tile -> 0,25 m/px
const ELEV = 128;             // segmentos de relevo por tile -> 2 m
const X0 = Math.floor(meta.x0 / TILE_M) * TILE_M;
const Y0 = Math.floor(meta.y0 / TILE_M) * TILE_M;
const COLS = Math.ceil((meta.x0 + meta.largura * meta.celula - X0) / TILE_M);
const LINS = Math.ceil((meta.y0 + meta.altura * meta.celula - Y0) / TILE_M);
console.log(`grade ${COLS}x${LINS} tiles de ${TILE_M} m a partir de (${X0}, ${Y0})`);

// O deslocamento de datum varia pouco na area: confere nos cantos.
const cantos = [[X0, Y0], [X0 + COLS * TILE_M, Y0], [X0, Y0 + LINS * TILE_M], [X0 + COLS * TILE_M, Y0 + LINS * TILE_M]]
    .map(([E, N]) => { const w = bimParaWgs84Utm(E, N + TRUNC); return { dE: w.E - E, dN: w.N - (N + TRUNC) }; });
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

// --- Amostragem ------------------------------------------------------------

/**
 * Coordenada do modelo -> pixel da ortofoto, por interpolacao numa malha.
 *
 * A transformacao e suave: a calibracao da grade e uma similaridade e o datum
 * e uma rotacao de elipsoide, que varia milimetros dentro da area do voo.
 * Amostrar a cada NO_M metros e interpolar bilinearmente cai dentro de um
 * centesimo de pixel — o `conferirMalha` abaixo mede isso a cada execucao.
 *
 * Sem ela seriam ~90 milhoes de reducoes de Newton, uma por texel, e a
 * geracao passaria de minutos para horas.
 */
const NO_M = 16;

function mapeadorDeTile(eOeste, nSul) {
    const nos = TILE_M / NO_M;
    const lado = nos + 1;
    const gx = new Float64Array(lado * lado), gy = new Float64Array(lado * lado);
    for (let a = 0; a < lado; a++) {
        for (let b = 0; b < lado; b++) {
            const w = bimParaWgs84Utm(eOeste + b * NO_M, nSul + a * NO_M + TRUNC);
            gx[a * lado + b] = (w.E - ORTO_E0) / M_ORTO - 0.5;
            gy[a * lado + b] = (ORTO_N0 - w.N) / M_ORTO - 0.5;
        }
    }
    return (E, N) => {
        const fb = (E - eOeste) / NO_M, fa = (N - nSul) / NO_M;
        const b0 = Math.min(nos - 1, Math.max(0, Math.floor(fb)));
        const a0 = Math.min(nos - 1, Math.max(0, Math.floor(fa)));
        const tb = fb - b0, ta = fa - a0;
        const k = a0 * lado + b0;
        const p = (g) => (g[k] * (1 - tb) + g[k + 1] * tb) * (1 - ta)
            + (g[k + lado] * (1 - tb) + g[k + lado + 1] * tb) * ta;
        return { sx: p(gx), sy: p(gy) };
    };
}

/** Erro maximo da malha contra a transformacao exata, em pixels da ortofoto. */
function conferirMalha(eOeste, nSul) {
    const mapa = mapeadorDeTile(eOeste, nSul);
    let pior = 0;
    for (let i = 0; i < 400; i++) {
        const E = eOeste + Math.random() * TILE_M, N = nSul + Math.random() * TILE_M;
        const w = bimParaWgs84Utm(E, N + TRUNC);
        const m = mapa(E, N);
        pior = Math.max(pior,
            Math.hypot(m.sx - ((w.E - ORTO_E0) / M_ORTO - 0.5), m.sy - ((ORTO_N0 - w.N) / M_ORTO - 0.5)));
    }
    return pior;
}

/**
 * Amostra bilinear da ortofoto reamostrada.
 *
 * O `Math.round` que havia aqui jogava cada texel para o centro do pixel mais
 * proximo, e como a grade do tile nao esta alinhada com a da ortofoto (ha
 * datum e rotacao no meio) isso serrilhava faixas, guias e bordas de pista.
 * Vizinho sem cobertura fica de fora da media, para nao puxar preto do vazio
 * na borda do voo.
 */
const amostra = new Float64Array(3);
function amostrarOrto(sx, sy) {
    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    const fx = sx - x0, fy = sy - y0;
    let r = 0, g = 0, b = 0, peso = 0;
    for (let dy = 0; dy < 2; dy++) {
        const y = y0 + dy;
        if (y < 0 || y >= infoOrto.height) continue;
        for (let dx = 0; dx < 2; dx++) {
            const x = x0 + dx;
            if (x < 0 || x >= infoOrto.width) continue;
            const s = (y * infoOrto.width + x) * 4;
            if (orto[s + 3] < 128) continue;
            const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
            r += orto[s] * w; g += orto[s + 1] * w; b += orto[s + 2] * w; peso += w;
        }
    }
    if (peso < 0.5) return false;                     // fora do voo
    amostra[0] = r / peso; amostra[1] = g / peso; amostra[2] = b / peso;
    return true;
}

// --- Geracao ---------------------------------------------------------------

const erroMalha = Math.max(
    conferirMalha(X0, Y0),
    conferirMalha(X0 + (COLS - 1) * TILE_M, Y0 + (LINS - 1) * TILE_M),
);
console.log(`malha de interpolacao: erro maximo ${erroMalha.toFixed(4)} px `
    + `(${(erroMalha * M_ORTO * 100).toFixed(2)} cm)`);
if (erroMalha > 0.25) {
    console.error('Malha de interpolacao grosseira demais. Reduza NO_M.');
    process.exit(1);
}

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
        const mapa = mapeadorDeTile(eOeste, nSul);
        let comTextura = 0;
        for (let ty = 0; ty < TEX; ty++) {
            const N = nSul + TILE_M * (1 - (ty + 0.5) / TEX);
            for (let tx = 0; tx < TEX; tx++) {
                const E = eOeste + TILE_M * ((tx + 0.5) / TEX);
                const { sx, sy } = mapa(E, N);
                if (!amostrarOrto(sx, sy)) continue;
                const d = (ty * TEX + tx) * 4;
                tex[d] = Math.round(amostra[0]);
                tex[d + 1] = Math.round(amostra[1]);
                tex[d + 2] = Math.round(amostra[2]);
                tex[d + 3] = 255;
                comTextura++;
            }
        }
        // Relevo sem imagem nao desenha nada — o alfa zero some tanto no modo
        // opaco, pelo alphaTest, quanto no translucido, pela mistura. Gravar o
        // tile so custaria memoria de video no viewer.
        if (comTextura === 0) continue;

        const nomeE = `e_${i}_${j}.png`, nomeT = `t_${i}_${j}.webp`;
        const pngElev = await sharp(elevRgb, { raw: { width: lado, height: lado, channels: 3 } })
            .png({ compressionLevel: 9, palette: false }).toBuffer();
        fs.writeFileSync(path.join(SAIDA, nomeE), pngElev);

        const webp = await sharp(tex, { raw: { width: TEX, height: TEX, channels: 4 } })
            // Qualidade alta de proposito: o WebP a 82 lavava textura de brita
            // e asfalto, justamente o que se ganha ao dobrar a resolucao.
            .webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer();
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
    // Canto sudoeste da grade. `easting`/`northingModelo` sao os valores
    // literais do modelo — e assim que o viewer posiciona o terreno, por
    // identidade de coordenada, sem datum nem fuso no meio.
    easting: X0,
    northingModelo: Y0,
    // Northing completo, so para leitura humana e conferencia em SIG.
    northing: Y0 + TRUNC,
    northingBase: TRUNC,
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
