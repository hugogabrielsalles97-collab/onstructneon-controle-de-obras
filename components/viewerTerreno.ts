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
    remover: () => void;
}

const CHAVE_CONFIGURACAO = 'elos.viewer.terrenoReal';
const CENA = 'elos-terreno-real';
const RAIO_DE_TILES = 2;
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
        return { latitude: config.latitude, longitude: config.longitude, automatica: false };
    }

    try {
        const extensao = await viewer.loadExtension?.('Autodesk.Geolocation');
        const centro = caixaDoModelo(viewer).getCenter();
        const geograficas = extensao?.lmvToLonLat?.(centro);
        const longitude = Number(geograficas?.x ?? geograficas?.[0]);
        const latitude = Number(geograficas?.y ?? geograficas?.[1]);

        if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 85 && Math.abs(longitude) <= 180) {
            return { latitude, longitude, automatica: true };
        }
    } catch {
        // Alguns NWDs não carregam metadados geográficos. A entrada manual
        // abaixo continua disponível e é mais segura que adivinhar o local.
    }

    throw new Error('O modelo não possui georreferenciamento detectável. Informe latitude e longitude do centro da obra.');
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

/** Carrega 5 × 5 tiles ao redor do centro da obra e os instala no overlay. */
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
        const tarefas: Promise<void>[] = [];
        for (let dy = -RAIO_DE_TILES; dy <= RAIO_DE_TILES; dy++) {
            for (let dx = -RAIO_DE_TILES; dx <= RAIO_DE_TILES; dx++) {
                const x = ((tileCentralX + dx) % totalTiles + totalTiles) % totalTiles;
                const y = Math.min(totalTiles - 1, Math.max(0, tileCentralY + dy));
                tarefas.push((async () => {
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
                })());
            }
        }

        await Promise.all(tarefas);
        abortado(signal);
        viewer.impl.invalidate?.(true, true, true);

        return {
            latitude: centro.latitude,
            longitude: centro.longitude,
            localizacaoAutomatica: centro.automatica,
            remover,
        };
    } catch (erro) {
        remover();
        throw erro;
    }
}
