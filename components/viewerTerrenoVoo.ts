import type { ConfiguracaoTerreno, TerrenoInstalado } from './viewerTerreno';

/**
 * Terreno levantado pelo voo da obra: relevo da nuvem de pontos e ortofoto.
 *
 * Ao contrário do terreno de satélite, aqui não há geodésia em tempo de
 * render. A nuvem foi entregue nas coordenadas do próprio projeto (UTM 23S /
 * SAD69, northing truncado) e a ortofoto já teve o datum corrigido na geração
 * dos tiles. Sobra uma soma: coordenada do projeto menos a âncora do modelo.
 *
 * É por isso que este caminho encaixa sem calibração — e por isso ele é o
 * preferido quando os tiles existem.
 */

const MANIFESTO_URL = '/terreno-voo/manifesto.json';
const BASE_TILES = '/terreno-voo/';
const CENA = 'elos-terreno-voo';
const OPACIDADE_INICIAL = 0.65;

/** Vértices por lado. Menos que o relevo entregue economiza memória sem achatar taludes. */
const SEGMENTOS_MAX = 256;

export interface TileVoo {
    i: number;
    j: number;
    relevo: string;
    textura: string;
}

export interface ManifestoVoo {
    /** Canto sudoeste da grade, nos valores literais do modelo. */
    easting: number;
    northingModelo: number;
    /** Northing completo e a base truncada — documentação, não usados no render. */
    northing?: number;
    northingBase?: number;
    datum: string;
    zona: number;
    tileMetros: number;
    colunas: number;
    linhas: number;
    segmentos: number;
    zBase: number;
    escalaZ: number;
    tiles: TileVoo[];
}

export interface ContextoVoo {
    THREE: any;
    /**
     * Deslocamento que o carregador aplicou ao modelo: viewer = modelo − offset.
     *
     * É a única coisa que este terreno precisa saber sobre o Viewer. Como a
     * nuvem foi entregue nas coordenadas literais do modelo, posicionar é
     * identidade de coordenada menos este offset — sem datum, fuso, nem a
     * busca por pontuação que o caminho de satélite precisa fazer.
     */
    offsetModelo: { x: number; y: number; z: number };
    metrosPorUnidade: number;
}

/**
 * Relação modelo↔Viewer, direto da fonte.
 *
 * `globalOffset` é o que o carregador subtrai das coordenadas do NWD para
 * manter a cena perto da origem. Não depende da caixa do federado, que traz
 * referências espalhadas por centenas de quilômetros.
 */
export function offsetDoModelo(viewer: any): { x: number; y: number; z: number } | null {
    const off = viewer?.model?.getData?.()?.globalOffset;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    if (off) {
        const x = n(off.x), y = n(off.y), z = n(off.z);
        if (x !== null && y !== null && z !== null) return { x, y, z };
    }

    // Sem globalOffset: a inversa modelo→Viewer aplicada à origem dá o mesmo.
    try {
        const inversa = viewer?.model?.getInverseModelToViewerTransform?.();
        const THREE = (window as any).THREE;
        if (inversa && THREE) {
            const p = new THREE.Vector3(0, 0, 0).applyMatrix4(inversa);
            const x = n(p.x), y = n(p.y), z = n(p.z);
            if (x !== null && y !== null && z !== null) return { x, y, z };
        }
    } catch { /* transformação ausente */ }

    // Modelo carregado sem deslocamento: coordenadas do Viewer são as do projeto.
    return { x: 0, y: 0, z: 0 };
}

const abortado = (signal: AbortSignal) => {
    if (signal.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
};

export async function carregarManifestoVoo(signal?: AbortSignal): Promise<ManifestoVoo | null> {
    try {
        const res = await fetch(MANIFESTO_URL, { signal, cache: 'force-cache' });
        if (!res.ok) return null;
        const m = await res.json();
        return Array.isArray(m?.tiles) && m.tiles.length > 0 ? m as ManifestoVoo : null;
    } catch {
        return null;
    }
}

function carregarImagem(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const cancelar = () => reject(new DOMException('Operação cancelada.', 'AbortError'));
        img.onload = () => { signal.removeEventListener('abort', cancelar); resolve(img); };
        img.onerror = () => {
            signal.removeEventListener('abort', cancelar);
            reject(new Error(`Falha ao carregar ${url}`));
        };
        signal.addEventListener('abort', cancelar, { once: true });
        img.src = url;
    });
}

/** Lê o PNG de relevo de volta para números. O canal RGB carrega centímetros. */
function decodificarRelevo(img: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Não foi possível decodificar o relevo do voo.');
    ctx.drawImage(img, 0, 0);
    return {
        largura: canvas.width,
        altura: canvas.height,
        dados: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    };
}

interface BaseTile {
    /** [leste, norte, cota] por vértice, no espaço do Viewer, antes da calibração. */
    base: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array | Uint32Array;
    vertices: number;
}

/**
 * Monta a grade de um tile pulando o que não foi levantado.
 *
 * Dois cortes importam: recorta a grade ao retângulo que de fato tem dado — há
 * tiles com 2% de cobertura, e alocar a grade inteira neles seria desperdício —
 * e descarta triângulos que toquem vértice sem cota, o que deixa a borda do
 * voo recortada em vez de esticada até o vazio.
 */
function montarBase(
    relevo: { largura: number; altura: number; dados: Uint8ClampedArray },
    tile: TileVoo,
    manifesto: ManifestoVoo,
    ctx: ContextoVoo,
): BaseTile | null {
    const passo = Math.max(1, Math.round((relevo.largura - 1) / Math.min(SEGMENTOS_MAX, manifesto.segmentos)));
    const seg = Math.floor((relevo.largura - 1) / passo);
    const lado = seg + 1;

    const cota = (lx: number, ly: number) => {
        const k = ((ly * passo) * relevo.largura + lx * passo) * 4;
        const cod = (relevo.dados[k] << 16) | (relevo.dados[k + 1] << 8) | relevo.dados[k + 2];
        return cod === 0 ? NaN : manifesto.zBase + (cod - 1) * manifesto.escalaZ;
    };

    let lxMin = lado, lxMax = -1, lyMin = lado, lyMax = -1;
    for (let ly = 0; ly < lado; ly++) {
        for (let lx = 0; lx < lado; lx++) {
            if (!Number.isFinite(cota(lx, ly))) continue;
            if (lx < lxMin) lxMin = lx; if (lx > lxMax) lxMax = lx;
            if (ly < lyMin) lyMin = ly; if (ly > lyMax) lyMax = ly;
        }
    }
    if (lxMax < lxMin || lyMax < lyMin) return null;

    // Uma faixa de folga mantém a costura com o tile vizinho.
    lxMin = Math.max(0, lxMin - 1); lxMax = Math.min(lado - 1, lxMax + 1);
    lyMin = Math.max(0, lyMin - 1); lyMax = Math.min(lado - 1, lyMax + 1);

    const cols = lxMax - lxMin + 1;
    const lins = lyMax - lyMin + 1;
    if (cols < 2 || lins < 2) return null;

    const { tileMetros } = manifesto;
    const eOeste = manifesto.easting + tile.i * tileMetros;
    const nSul = manifesto.northingModelo + tile.j * tileMetros;

    const base = new Float32Array(cols * lins * 3);
    const uvs = new Float32Array(cols * lins * 2);
    const valido = new Uint8Array(cols * lins);

    let p = 0, q = 0;
    for (let ly = lyMin; ly <= lyMax; ly++) {
        const fy = ly / seg;
        const N = nSul + tileMetros * (1 - fy);
        for (let lx = lxMin; lx <= lxMax; lx++) {
            const fx = lx / seg;
            const E = eOeste + tileMetros * fx;
            const z = cota(lx, ly);
            const idx = (ly - lyMin) * cols + (lx - lxMin);
            valido[idx] = Number.isFinite(z) ? 1 : 0;

            // Coordenada do modelo menos o deslocamento do carregador. Os
            // valores da nuvem já são os do modelo, então não há conversão.
            base[p++] = E - ctx.offsetModelo.x;
            base[p++] = N - ctx.offsetModelo.y;
            base[p++] = (Number.isFinite(z) ? z : manifesto.zBase) - ctx.offsetModelo.z;

            uvs[q++] = fx;
            uvs[q++] = 1 - fy;
        }
    }

    const triangulos: number[] = [];
    for (let y = 0; y < lins - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
            const a = y * cols + x, b = a + 1, c = a + cols, d = c + 1;
            if (valido[a] && valido[c] && valido[b]) triangulos.push(a, c, b);
            if (valido[b] && valido[c] && valido[d]) triangulos.push(b, c, d);
        }
    }
    if (triangulos.length === 0) return null;

    const vertices = cols * lins;
    const indices = vertices > 65535 ? new Uint32Array(triangulos) : new Uint16Array(triangulos);
    return { base, uvs, indices, vertices };
}

function calcularPosicoes(
    base: Float32Array,
    ctx: ContextoVoo,
    config: ConfiguracaoTerreno,
    destino?: Float32Array,
) {
    const pos = destino ?? new Float32Array(base.length);
    const mpu = ctx.metrosPorUnidade;
    const ang = config.rotacao * Math.PI / 180;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    // A base já está no espaço do Viewer; só o ajuste fino, que o usuário
    // informa em metros, precisa virar unidades do modelo.
    const dx = config.deslocamentoX / mpu;
    const dy = config.deslocamentoY / mpu;
    const dz = config.deslocamentoZ / mpu;

    for (let i = 0; i < base.length; i += 3) {
        const leste = base[i], norte = base[i + 1];
        pos[i] = dx + leste * cos - norte * sin;
        pos[i + 1] = dy + leste * sin + norte * cos;
        pos[i + 2] = dz + base[i + 2];
    }
    return pos;
}

/** Instala o terreno do voo. O chamador já resolveu a âncora modelo↔Viewer. */
export async function instalarTerrenoDoVoo(
    viewer: any,
    manifesto: ManifestoVoo,
    config: ConfiguracaoTerreno,
    signal: AbortSignal,
    ctx: ContextoVoo,
): Promise<Pick<TerrenoInstalado, 'definirOpacidade' | 'ajustar' | 'remover'>> {
    const { THREE } = ctx;

    const cena = `${CENA}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (viewer.overlays?.addScene) viewer.overlays.addScene(cena);
    else viewer.impl.createOverlayScene(cena);

    const malhas: any[] = [];
    const detalhes: Array<{ malha: any; base: Float32Array }> = [];
    let removido = false;

    const definirOpacidade = (valor: number) => {
        const o = Math.min(1, Math.max(0, Number.isFinite(valor) ? valor : OPACIDADE_INICIAL));
        const opaco = o >= 1;
        for (const malha of malhas) {
            const m = malha.material;
            m.opacity = o;
            m.transparent = !opaco;
            m.depthWrite = opaco;
            m.needsUpdate = true;
        }
        viewer.impl.invalidate?.(true, true, true);
    };

    const ajustar = (novo: ConfiguracaoTerreno) => {
        if (removido) return;
        for (const d of detalhes) {
            const attr = d.malha.geometry.getAttribute?.('position') ?? d.malha.geometry.attributes?.position;
            if (!attr) continue;
            calcularPosicoes(d.base, ctx, novo, attr.array as Float32Array);
            attr.needsUpdate = true;
            d.malha.geometry.computeBoundingSphere?.();
        }
        viewer.impl.invalidate?.(true, true, true);
    };

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
        for (const tile of manifesto.tiles) {
            abortado(signal);
            const [imgRelevo, imgTextura] = await Promise.all([
                carregarImagem(BASE_TILES + tile.relevo, signal),
                carregarImagem(BASE_TILES + tile.textura, signal),
            ]);
            abortado(signal);
            if (removido) return { definirOpacidade, ajustar, remover };

            const montado = montarBase(decodificarRelevo(imgRelevo), tile, manifesto, ctx);
            if (!montado) continue;

            const textura = new THREE.Texture(imgTextura);
            textura.needsUpdate = true;
            textura.generateMipmaps = true;
            textura.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearMipMapLinearFilter || THREE.LinearFilter;
            textura.magFilter = THREE.LinearFilter;
            textura.anisotropy = 4;

            const geo = new THREE.BufferGeometry();
            const posicoes = calcularPosicoes(montado.base, ctx, config);
            const setar = (nome: string, valor: any) => {
                if (geo.setAttribute) geo.setAttribute(nome, valor); else geo.addAttribute(nome, valor);
            };
            setar('position', new THREE.BufferAttribute(posicoes, 3));
            setar('uv', new THREE.BufferAttribute(montado.uvs, 2));
            const indice = new THREE.BufferAttribute(montado.indices, 1);
            if (geo.setIndex) geo.setIndex(indice); else setar('index', indice);
            geo.computeVertexNormals?.();
            geo.computeBoundingSphere?.();

            const material = new THREE.MeshBasicMaterial({
                map: textura,
                side: THREE.DoubleSide,
                opacity: OPACIDADE_INICIAL,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
                // A ortofoto tem alfa: fora da área voada o tile é vazado.
                alphaTest: 0.5,
            });

            const malha = new THREE.Mesh(geo, material);
            malha.frustumCulled = false;
            malhas.push(malha);
            detalhes.push({ malha, base: montado.base });

            if (viewer.overlays?.addMesh) viewer.overlays.addMesh(malha, cena);
            else viewer.impl.addOverlay(cena, malha);
            viewer.impl.invalidate?.(false, false, true);

            // Entrega um quadro entre tiles para o Viewer seguir respondendo.
            await new Promise<void>(r => requestAnimationFrame(() => r()));
        }

        if (malhas.length === 0) throw new Error('Os tiles do voo não cobriram nenhuma área deste modelo.');
        viewer.impl.invalidate?.(true, true, true);
        return { definirOpacidade, ajustar, remover };
    } catch (erro) {
        remover();
        throw erro;
    }
}
