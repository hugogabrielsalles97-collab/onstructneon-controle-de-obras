import type { LercData } from 'lerc';
import lercWasmUrl from 'lerc/lerc-wasm.wasm?url';

/**
 * Camada opcional de contexto real para o Autodesk Viewer.
 *
 * A elevação e a imagem são carregadas somente quando o usuário liga a opção.
 * A cena fica em um overlay separado, portanto não participa da árvore do
 * modelo, da seleção, dos presets ou da pintura de avanço.
 */

export interface ConfiguracaoTerreno {
    latitude: number | null;
    longitude: number | null;
    zoom: number;
    deslocamentoX: number;
    deslocamentoY: number;
    deslocamentoZ: number;
    rotacao: number;
}

export interface TerrenoInstalado {
    latitude: number;
    longitude: number;
    localizacaoAutomatica: boolean;
    origemLocalizacao: string;
    remover: () => void;
}

interface CentroGeografico {
    latitude: number;
    longitude: number;
    automatica: boolean;
    origem: string;
}

const CHAVE_CONFIGURACAO = 'elos.viewer.terrenoReal';
const CENA = 'elos-terreno-real';
// 3 × 3 cobre aproximadamente 12 km neste projeto e mantém tablets/celulares
// responsivos. O carregamento anterior de 5 × 5 decodificava 25 relevos.
const RAIO_DE_TILES = 1;
const CONCORRENCIA_TILES = 3;
const SEGMENTOS = 32;
const RAIO_TERRA = 6378137;
let lercPronto: Promise<typeof import('lerc')> | null = null;

const IMAGEM_URL = (z: number, x: number, y: number) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const ELEVACAO_URL = (z: number, x: number, y: number) =>
    `https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/tile/${z}/${y}/${x}`;

const prepararLerc = () => {
    if (!lercPronto) {
        lercPronto = import('lerc').then(async Lerc => {
            await Lerc.load({ locateFile: () => lercWasmUrl });
            return Lerc;
        });
    }
    return lercPronto;
};

export const CONFIGURACAO_TERRENO_PADRAO: ConfiguracaoTerreno = {
    latitude: null,
    longitude: null,
    zoom: 13,
    deslocamentoX: 0,
    deslocamentoY: 0,
    deslocamentoZ: 0,
    rotacao: 0,
};

const numeroFinito = (valor: unknown, padrao: number) =>
    typeof valor === 'number' && Number.isFinite(valor) ? valor : padrao;

const coordenadaOuNula = (valor: unknown, minimo: number, maximo: number) =>
    typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo
        ? valor
        : null;

export function lerConfiguracaoTerreno(): ConfiguracaoTerreno {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_CONFIGURACAO) || '{}');
        return {
            latitude: coordenadaOuNula(salvo.latitude, -85, 85),
            longitude: coordenadaOuNula(salvo.longitude, -180, 180),
            zoom: Math.round(Math.min(16, Math.max(11, numeroFinito(salvo.zoom, 13)))),
            deslocamentoX: numeroFinito(salvo.deslocamentoX, 0),
            deslocamentoY: numeroFinito(salvo.deslocamentoY, 0),
            deslocamentoZ: numeroFinito(salvo.deslocamentoZ, 0),
            rotacao: numeroFinito(salvo.rotacao, 0),
        };
    } catch {
        return { ...CONFIGURACAO_TERRENO_PADRAO };
    }
}

export function gravarConfiguracaoTerreno(config: ConfiguracaoTerreno) {
    try { localStorage.setItem(CHAVE_CONFIGURACAO, JSON.stringify(config)); } catch { /* modo privado */ }
}

const abortado = (signal: AbortSignal) => {
    if (signal.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
};

const numero = (valor: unknown) => {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (typeof valor !== 'string') return null;
    const convertido = Number(valor.trim().replace(',', '.'));
    return Number.isFinite(convertido) ? convertido : null;
};

const coordenadaValida = (latitude: number, longitude: number) =>
    Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 85 && Math.abs(longitude) <= 180;

/** Procura pares latitude/longitude nos metadados, sem depender do nome exato das chaves. */
function procurarLonLat(valor: unknown, profundidade = 0): { latitude: number; longitude: number } | null {
    if (!valor || typeof valor !== 'object' || profundidade > 7) return null;

    const objeto = valor as Record<string, unknown>;
    const entradas = Object.entries(objeto);
    const latitude = entradas.find(([chave]) => /^(lat|latitude)$/i.test(chave.trim()));
    const longitude = entradas.find(([chave]) => /^(lon|lng|long|longitude)$/i.test(chave.trim()));
    const lat = numero(latitude?.[1]);
    const lon = numero(longitude?.[1]);
    if (lat !== null && lon !== null && coordenadaValida(lat, lon)) return { latitude: lat, longitude: lon };

    for (const [, filho] of entradas) {
        const encontrado = procurarLonLat(filho, profundidade + 1);
        if (encontrado) return encontrado;
    }
    return null;
}

const UFS: Record<string, { latitude: number; longitude: number }> = {
    AC: { latitude: -9.0, longitude: -70.0 }, AL: { latitude: -9.6, longitude: -36.6 },
    AP: { latitude: 1.0, longitude: -52.0 }, AM: { latitude: -4.0, longitude: -64.5 },
    BA: { latitude: -12.5, longitude: -41.5 }, CE: { latitude: -5.2, longitude: -39.5 },
    DF: { latitude: -15.8, longitude: -47.9 }, ES: { latitude: -19.6, longitude: -40.5 },
    GO: { latitude: -15.9, longitude: -49.3 }, MA: { latitude: -5.0, longitude: -45.0 },
    MT: { latitude: -12.7, longitude: -55.7 }, MS: { latitude: -20.4, longitude: -54.6 },
    MG: { latitude: -18.5, longitude: -44.0 }, PA: { latitude: -4.0, longitude: -52.0 },
    PB: { latitude: -7.1, longitude: -36.8 }, PR: { latitude: -24.5, longitude: -51.5 },
    PE: { latitude: -8.4, longitude: -37.9 }, PI: { latitude: -7.7, longitude: -42.7 },
    RJ: { latitude: -22.3, longitude: -42.9 }, RN: { latitude: -5.8, longitude: -36.6 },
    RS: { latitude: -30.0, longitude: -53.0 }, RO: { latitude: -10.8, longitude: -63.0 },
    RR: { latitude: 2.0, longitude: -61.0 }, SC: { latitude: -27.0, longitude: -50.5 },
    SP: { latitude: -22.2, longitude: -47.2 }, SE: { latitude: -10.6, longitude: -37.4 },
    TO: { latitude: -10.2, longitude: -48.3 },
};

function nomeDoModelo(viewer: any) {
    const no = viewer?.model?.getDocumentNode?.();
    const nomes = [
        typeof no?.name === 'function' ? no.name() : no?.name,
        no?.data?.name,
        viewer?.model?.getData?.()?.name,
        viewer?.model?.getData?.()?.loadOptions?.modelNameOverride,
    ];
    return nomes.find(valor => typeof valor === 'string' && valor.trim())?.trim() || '';
}

function ufDoNome(nome: string) {
    const normalizado = nome.toUpperCase();
    for (const uf of Object.keys(UFS)) {
        // Aceita tanto "116RJ-218" quanto "BR-116-RJ-218", evitando letras
        // soltas dentro de outras palavras do nome do arquivo.
        if (new RegExp(`(?:\\d{2,3}|[-_ ])${uf}(?:[-_ 0-9]|$)`).test(normalizado)) return uf;
    }
    return null;
}

/** Conversão inversa WGS84 UTM, suficiente para posicionar o centro dos tiles. */
function utmParaWgs84(easting: number, northing: number, zona: number, sul: boolean) {
    const a = 6378137;
    const ecc = 0.00669438;
    const k0 = 0.9996;
    const eccLinha = ecc / (1 - ecc);
    const e1 = (1 - Math.sqrt(1 - ecc)) / (1 + Math.sqrt(1 - ecc));
    const x = easting - 500000;
    const y = sul ? northing - 10000000 : northing;
    const m = y / k0;
    const mu = m / (a * (1 - ecc / 4 - 3 * ecc ** 2 / 64 - 5 * ecc ** 3 / 256));
    const phi1 = mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
        + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const n1 = a / Math.sqrt(1 - ecc * Math.sin(phi1) ** 2);
    const t1 = Math.tan(phi1) ** 2;
    const c1 = eccLinha * Math.cos(phi1) ** 2;
    const r1 = a * (1 - ecc) / (1 - ecc * Math.sin(phi1) ** 2) ** 1.5;
    const d = x / (n1 * k0);
    const latitudeRad = phi1 - (n1 * Math.tan(phi1) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccLinha) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eccLinha - 3 * c1 ** 2) * d ** 6 / 720
    );
    const longitudeOrigem = (zona - 1) * 6 - 180 + 3;
    const longitudeRad = (
        d - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eccLinha + 24 * t1 ** 2) * d ** 5 / 120
    ) / Math.cos(phi1);

    return {
        latitude: latitudeRad * 180 / Math.PI,
        longitude: longitudeOrigem + longitudeRad * 180 / Math.PI,
    };
}

function centrosOriginaisDoModelo(viewer: any) {
    const caixa = caixaDoModelo(viewer);
    const centro = caixa.getCenter();
    const candidatos: Array<{ x: number; y: number }> = [];
    const incluir = (ponto: any) => {
        const x = numero(ponto?.x);
        const y = numero(ponto?.y);
        if (x !== null && y !== null && !candidatos.some(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01)) {
            candidatos.push({ x, y });
        }
    };

    incluir(centro);
    try {
        const inversa = viewer.model?.getInverseModelToViewerTransform?.();
        if (inversa && (window as any).THREE) {
            incluir(new (window as any).THREE.Vector3(centro.x, centro.y, centro.z).applyMatrix4(inversa));
        }
    } catch { /* transformação ausente */ }

    const offset = viewer.model?.getData?.()?.globalOffset;
    incluir(offset);
    if (offset) incluir({ x: centro.x + Number(offset.x || 0), y: centro.y + Number(offset.y || 0) });
    return candidatos;
}

function centroPorUtm(viewer: any): CentroGeografico | null {
    const nome = nomeDoModelo(viewer);
    const uf = ufDoNome(nome);
    if (!uf) return null;

    const referencia = UFS[uf];
    const zona = Math.floor((referencia.longitude + 180) / 6) + 1;
    const sul = referencia.latitude < 0;
    let melhor: { latitude: number; longitude: number; score: number } | null = null;

    for (const ponto of centrosOriginaisDoModelo(viewer)) {
        if (ponto.x < 100000 || ponto.x > 900000) continue;
        const northings = ponto.y >= 1000000
            ? [ponto.y]
            : [6, 7, 8, 9].map(milhao => ponto.y + milhao * 1000000);

        for (const northing of northings) {
            if (northing < 0 || northing > 10000000) continue;
            const convertido = utmParaWgs84(ponto.x, northing, zona, sul);
            if (!coordenadaValida(convertido.latitude, convertido.longitude)) continue;
            const score = Math.abs(convertido.latitude - referencia.latitude) * 1.5
                + Math.abs(convertido.longitude - referencia.longitude);
            if (!melhor || score < melhor.score) melhor = { ...convertido, score };
        }
    }

    // Impede que uma coordenada cartesiana qualquer seja aceita só porque
    // numericamente cabe na faixa UTM do estado.
    if (!melhor || melhor.score > 7) return null;
    return {
        latitude: melhor.latitude,
        longitude: melhor.longitude,
        automatica: true,
        origem: `coordenadas UTM do modelo (${zona}${sul ? 'S' : 'N'})`,
    };
}

async function centroPorAec(viewer: any): Promise<CentroGeografico | null> {
    try {
        const no = viewer.model?.getDocumentNode?.();
        // Só usa AEC já presente em memória. Solicitar o arquivo completo aqui
        // pode ser caro e é desnecessário para este NWD, que traz UTM.
        const aec = no?.getAecModelData?.();
        const encontrado = procurarLonLat(aec);
        return encontrado ? { ...encontrado, automatica: true, origem: 'metadados AEC do modelo' } : null;
    } catch {
        return null;
    }
}

function centroPeloDispositivo(): Promise<CentroGeografico | null> {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
            posicao => resolve({
                latitude: posicao.coords.latitude,
                longitude: posicao.coords.longitude,
                automatica: true,
                origem: 'localização do dispositivo',
            }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
        );
    });
}

function caixaDoModelo(viewer: any) {
    const caixa = viewer?.model?.getBoundingBox?.();
    if (!caixa || !Number.isFinite(caixa.min?.x) || !Number.isFinite(caixa.max?.x)) {
        throw new Error('Não foi possível calcular a posição do modelo 3D.');
    }
    return caixa;
}

async function resolverCentro(viewer: any, config: ConfiguracaoTerreno) {
    if ((config.latitude === null) !== (config.longitude === null)) {
        throw new Error('Informe latitude e longitude juntas ou deixe ambas vazias para a detecção automática.');
    }
    if (config.latitude !== null && config.longitude !== null) {
        return { latitude: config.latitude, longitude: config.longitude, automatica: false, origem: 'coordenadas informadas' };
    }

    // O federado da obra usa coordenadas UTM no próprio NWD. Esta leitura é
    // imediata e precisa vir antes de extensões e metadados potencialmente
    // grandes, evitando bloquear a interface do Viewer.
    const utm = centroPorUtm(viewer);
    if (utm) return utm;

    try {
        const extensao = await viewer.loadExtension?.('Autodesk.Geolocation');
        const centro = caixaDoModelo(viewer).getCenter();
        const possuiDados = extensao?.hasGeolocationData?.();
        const geograficas = possuiDados === false ? null : extensao?.lmvToLonLat?.(centro);
        const longitude = Number(geograficas?.x ?? geograficas?.[0]);
        const latitude = Number(geograficas?.y ?? geograficas?.[1]);

        if (coordenadaValida(latitude, longitude)) {
            return { latitude, longitude, automatica: true, origem: 'georreferenciamento APS' };
        }
    } catch {
        // Alguns NWDs não carregam metadados geográficos nativos.
    }

    const aec = await centroPorAec(viewer);
    if (aec) return aec;

    const dispositivo = await centroPeloDispositivo();
    if (dispositivo) return dispositivo;

    throw new Error('Não foi possível obter a localização automaticamente. Autorize a localização do navegador e tente novamente.');
}

function longitudeParaTile(longitude: number, zoom: number) {
    return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeParaTile(latitude: number, zoom: number) {
    const rad = latitude * Math.PI / 180;
    return (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * 2 ** zoom;
}

async function carregarElevacao(z: number, x: number, y: number, signal: AbortSignal): Promise<LercData> {
    const resposta = await fetch(ELEVACAO_URL(z, x, y), { signal });
    if (!resposta.ok) throw new Error(`elevação ${z}/${x}/${y} indisponível (${resposta.status})`);

    const Lerc = await prepararLerc();
    abortado(signal);
    return Lerc.decode(await resposta.arrayBuffer());
}

async function carregarTextura(THREE: any, z: number, x: number, y: number, signal: AbortSignal) {
    const resposta = await fetch(IMAGEM_URL(z, x, y), { signal });
    if (!resposta.ok) throw new Error(`imagem ${z}/${x}/${y} indisponível (${resposta.status})`);

    const url = URL.createObjectURL(await resposta.blob());
    try {
        const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            const cancelar = () => reject(new DOMException('Operação cancelada.', 'AbortError'));
            img.onload = () => { signal.removeEventListener('abort', cancelar); resolve(img); };
            img.onerror = () => { signal.removeEventListener('abort', cancelar); reject(new Error('Falha ao preparar a imagem de satélite.')); };
            signal.addEventListener('abort', cancelar, { once: true });
            img.src = url;
        });
        abortado(signal);
        const textura = new THREE.Texture(imagem);
        textura.needsUpdate = true;
        textura.minFilter = THREE.LinearFilter;
        textura.magFilter = THREE.LinearFilter;
        return textura;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function amostrar(dados: LercData, u: number, v: number) {
    const x = Math.min(dados.width - 1, Math.max(0, Math.round(u * (dados.width - 1))));
    const y = Math.min(dados.height - 1, Math.max(0, Math.round(v * (dados.height - 1))));
    const indice = y * dados.width + x;
    if (dados.mask && dados.mask[indice] === 0) return Number.NaN;
    return Number(dados.pixels[0][indice]);
}

function atributo(geometria: any, nome: string, valor: any) {
    if (geometria.setAttribute) geometria.setAttribute(nome, valor);
    else geometria.addAttribute(nome, valor);
}

function montarMalha(
    THREE: any,
    dados: LercData,
    textura: any,
    tileX: number,
    tileY: number,
    tileXFlutuante: number,
    tileYFlutuante: number,
    tamanhoTile: number,
    metrosPorUnidade: number,
    elevacaoReferencia: number,
    origem: { x: number; y: number; z: number },
    config: ConfiguracaoTerreno,
) {
    const posicoes: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const angulo = config.rotacao * Math.PI / 180;
    const cos = Math.cos(angulo);
    const sin = Math.sin(angulo);
    let ultimaElevacao = elevacaoReferencia;

    for (let linha = 0; linha <= SEGMENTOS; linha++) {
        const v = linha / SEGMENTOS;
        for (let coluna = 0; coluna <= SEGMENTOS; coluna++) {
            const u = coluna / SEGMENTOS;
            const elevacaoLida = amostrar(dados, u, v);
            const elevacao = Number.isFinite(elevacaoLida) ? elevacaoLida : ultimaElevacao;
            ultimaElevacao = elevacao;

            const leste = (tileX - tileXFlutuante + u) * tamanhoTile / metrosPorUnidade;
            const norte = -(tileY - tileYFlutuante + v) * tamanhoTile / metrosPorUnidade;
            const x = leste * cos - norte * sin;
            const y = leste * sin + norte * cos;

            posicoes.push(
                origem.x + config.deslocamentoX / metrosPorUnidade + x,
                origem.y + config.deslocamentoY / metrosPorUnidade + y,
                origem.z + config.deslocamentoZ / metrosPorUnidade + (elevacao - elevacaoReferencia) / metrosPorUnidade,
            );
            uvs.push(u, 1 - v);
        }
    }

    const lado = SEGMENTOS + 1;
    for (let linha = 0; linha < SEGMENTOS; linha++) {
        for (let coluna = 0; coluna < SEGMENTOS; coluna++) {
            const a = linha * lado + coluna;
            const b = a + 1;
            const c = a + lado;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }

    const geometria = new THREE.BufferGeometry();
    atributo(geometria, 'position', new THREE.BufferAttribute(new Float32Array(posicoes), 3));
    atributo(geometria, 'uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    const indice = new THREE.BufferAttribute(new Uint16Array(indices), 1);
    if (geometria.setIndex) geometria.setIndex(indice); else atributo(geometria, 'index', indice);
    geometria.computeVertexNormals?.();
    geometria.computeBoundingSphere?.();

    const material = new THREE.MeshBasicMaterial({ map: textura, side: THREE.DoubleSide });
    const malha = new THREE.Mesh(geometria, material);
    malha.frustumCulled = false;
    return malha;
}

/** Carrega 3 × 3 tiles ao redor do centro da obra e os instala no overlay. */
export async function instalarTerrenoReal(
    viewer: any,
    config: ConfiguracaoTerreno,
    signal: AbortSignal,
): Promise<TerrenoInstalado> {
    const THREE = (window as any).THREE;
    if (!THREE) throw new Error('O mecanismo 3D do visualizador não está disponível.');
    if (!Number.isFinite(config.zoom) || config.zoom < 11 || config.zoom > 16) {
        throw new Error('Selecione uma área de terreno válida.');
    }

    const centro = await resolverCentro(viewer, config);
    abortado(signal);

    const caixa = caixaDoModelo(viewer);
    const centroModelo = caixa.getCenter();
    const origem = { x: centroModelo.x, y: centroModelo.y, z: caixa.min.z };
    const zoom = config.zoom;
    const tileXFlutuante = longitudeParaTile(centro.longitude, zoom);
    const tileYFlutuante = latitudeParaTile(centro.latitude, zoom);
    const tileCentralX = Math.floor(tileXFlutuante);
    const tileCentralY = Math.floor(tileYFlutuante);
    const totalTiles = 2 ** zoom;
    const tamanhoTile = Math.cos(centro.latitude * Math.PI / 180) * 2 * Math.PI * RAIO_TERRA / totalTiles;
    const metrosPorUnidadeLido = Number(viewer.model?.getUnitScale?.());
    const metrosPorUnidade = Number.isFinite(metrosPorUnidadeLido) && metrosPorUnidadeLido > 0
        ? metrosPorUnidadeLido
        : 1;

    await prepararLerc();
    const central = await carregarElevacao(zoom, tileCentralX, tileCentralY, signal);
    const elevacaoReferencia = amostrar(
        central,
        tileXFlutuante - tileCentralX,
        tileYFlutuante - tileCentralY,
    );
    if (!Number.isFinite(elevacaoReferencia)) throw new Error('A elevação do centro informado não está disponível.');

    const cena = `${CENA}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (viewer.overlays?.addScene) viewer.overlays.addScene(cena);
    else viewer.impl.createOverlayScene(cena);
    const malhas: any[] = [];
    let removido = false;
    const remover = () => {
        if (removido) return;
        removido = true;
        for (const malha of malhas) {
            try {
                if (viewer.overlays?.removeMesh) viewer.overlays.removeMesh(malha, cena);
                else viewer.impl.removeOverlay(cena, malha);
            } catch { /* viewer encerrado */ }
            malha.geometry?.dispose?.();
            malha.material?.map?.dispose?.();
            malha.material?.dispose?.();
        }
        try {
            if (viewer.overlays?.removeScene) viewer.overlays.removeScene(cena);
            else viewer.impl.removeOverlayScene(cena);
        } catch { /* já removida */ }
        viewer.impl.invalidate?.(true, true, true);
    };

    try {
        const tiles: Array<{ dx: number; dy: number; x: number; y: number }> = [];
        for (let dy = -RAIO_DE_TILES; dy <= RAIO_DE_TILES; dy++) {
            for (let dx = -RAIO_DE_TILES; dx <= RAIO_DE_TILES; dx++) {
                const x = ((tileCentralX + dx) % totalTiles + totalTiles) % totalTiles;
                const y = Math.min(totalTiles - 1, Math.max(0, tileCentralY + dy));
                tiles.push({ dx, dy, x, y });
            }
        }

        let cursor = 0;
        const trabalhador = async () => {
            while (cursor < tiles.length) {
                const { dx, dy, x, y } = tiles[cursor++];
                const [dados, textura] = await Promise.all([
                    dx === 0 && dy === 0 ? central : carregarElevacao(zoom, x, y, signal),
                    carregarTextura(THREE, zoom, x, y, signal),
                ]);
                abortado(signal);
                if (removido) { textura.dispose?.(); return; }
                const malha = montarMalha(
                    THREE, dados, textura,
                    tileCentralX + dx, tileCentralY + dy,
                    tileXFlutuante, tileYFlutuante,
                    tamanhoTile, metrosPorUnidade, elevacaoReferencia,
                    origem, config,
                );
                malhas.push(malha);
                if (viewer.overlays?.addMesh) viewer.overlays.addMesh(malha, cena);
                else viewer.impl.addOverlay(cena, malha);
                viewer.impl.invalidate?.(false, false, true);

                // Entrega um quadro ao navegador entre tiles para que os
                // controles do Viewer continuem respondendo ao usuário.
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            }
        };

        await Promise.all(Array.from({ length: CONCORRENCIA_TILES }, () => trabalhador()));
        abortado(signal);
        viewer.impl.invalidate?.(true, true, true);

        return {
            latitude: centro.latitude,
            longitude: centro.longitude,
            localizacaoAutomatica: centro.automatica,
            origemLocalizacao: centro.origem,
            remover,
        };
    } catch (erro) {
        remover();
        throw erro;
    }
}
