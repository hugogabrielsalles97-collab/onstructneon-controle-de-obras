import type { LercData } from 'lerc';
import lercWasmUrl from 'lerc/lerc-wasm.wasm?url';

/**
 * Camada opcional de contexto real para o Autodesk Viewer.
 *
 * A elevação e a imagem são carregadas somente quando o usuário liga a opção.
 * A cena fica em um overlay separado, portanto não participa da árvore do
 * modelo, da seleção, dos presets ou da pintura de avanço.
 */

/** Datum horizontal do levantamento que originou as coordenadas do modelo. */
export type DatumTerreno = 'auto' | 'sirgas2000' | 'sad69';

export interface ConfiguracaoTerreno {
    latitude: number | null;
    longitude: number | null;
    zoom: number;
    /** Deslocamento fino para leste, em metros. */
    deslocamentoX: number;
    /** Deslocamento fino para norte, em metros. */
    deslocamentoY: number;
    /** Deslocamento fino de cota, em metros. */
    deslocamentoZ: number;
    rotacao: number;
    datum: DatumTerreno;
}

export interface TerrenoInstalado {
    latitude: number;
    longitude: number;
    localizacaoAutomatica: boolean;
    origemLocalizacao: string;
    /** Datum efetivamente usado, já resolvido quando a configuração é 'auto'. */
    datumUsado: Exclude<DatumTerreno, 'auto'>;
    definirOpacidade: (opacidade: number) => void;
    /**
     * Reposiciona o terreno já carregado com uma nova calibração.
     *
     * Reaproveita relevo e texturas em memória: o ajuste fino é imediato e não
     * refaz nenhuma requisição, o que torna viável acertar o encaixe na mão.
     */
    ajustar: (config: ConfiguracaoTerreno) => void;
    remover: () => void;
}

interface CentroGeografico {
    latitude: number;
    longitude: number;
    automatica: boolean;
    origem: string;
    ancoraViewer?: { x: number; y: number; z: number };
    utm?: {
        easting: number;
        northing: number;
        zona: number;
        sul: boolean;
        datum: 'sirgas2000' | 'sad69';
    };
    /**
     * Quanto a cota do modelo excede a cota do Viewer no ponto de âncora
     * (zModelo − zViewer). É o que permite plantar o terreno na elevação real
     * do solo em vez de numa altura arbitrária.
     */
    offsetVerticalModelo?: number;
    /** Ajuste altimétrico obtido dos pontos cotados do levantamento BIM. */
    correcaoVerticalBim?: number;
}

const CHAVE_CONFIGURACAO = 'elos.viewer.terrenoReal';
const VERSAO_GEOREFERENCIAMENTO = 2;
const CENA = 'elos-terreno-real';
// 3 × 3 cobre aproximadamente 12 km neste projeto e mantém tablets/celulares
// responsivos. O carregamento anterior de 5 × 5 decodificava 25 relevos.
const RAIO_DE_TILES = 1;
const CONCORRENCIA_TILES = 2;

/**
 * Densidade da malha de relevo, em segmentos por tile.
 *
 * Um tile de zoom 13 cobre ~4,5 km, e o relevo da Esri vem com 257 amostras —
 * cerca de 18 m entre pontos. Com 32 segmentos o vértice caía a cada 141 m e a
 * malha errava a cota real em 10 m RMS, chegando a 44 m nas encostas da serra.
 * Numa vista minimamente inclinada esse erro de cota arrasta a ortofoto no
 * plano, porque a imagem é drapejada sobre a superfície: 44 m de cota a 30° do
 * nadir deslocam a textura uns 25 m no terreno.
 *
 * O teto acompanha a resolução nativa do relevo — passar disso só multiplica
 * triângulos sem ganhar informação.
 */
const SEGMENTOS_MAX = 256;
const SEGMENTOS_MIN = 32;
const RAIO_TERRA = 6378137;
const RESOLUCAO_TEXTURA_BASE = 2048;
const RESOLUCAO_TEXTURA_CENTRAL = 4096;
const OPACIDADE_INICIAL = 0.65;
let lercPronto: Promise<typeof import('lerc')> | null = null;

const IMAGEM_TILE_URL = (z: number, x: number, y: number) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

/**
 * Pede ao serviço a mesma área geográfica do tile de relevo, mas renderizada
 * em até 4096 px. A área central recebe a resolução máxima; as oito áreas
 * periféricas permanecem em 2048 px para não saturar a memória de vídeo.
 */
const IMAGEM_ALTA_URL = (z: number, x: number, y: number, resolucao: number) => {
    const limite = Math.PI * RAIO_TERRA;
    const tamanho = 2 * limite / 2 ** z;
    const esquerda = -limite + x * tamanho;
    const direita = esquerda + tamanho;
    const topo = limite - y * tamanho;
    const base = topo - tamanho;
    const bbox = [esquerda, base, direita, topo].join(',');

    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export`
        + `?bbox=${bbox}&bboxSR=3857&imageSR=3857`
        + `&size=${resolucao},${resolucao}&format=jpg&f=image`;
};

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
    datum: 'auto',
};

/** Limite do ajuste fino: além disso o erro é de georreferenciamento, não de calibração. */
export const LIMITE_DESLOCAMENTO = 500;

const numeroFinito = (valor: unknown, padrao: number) =>
    typeof valor === 'number' && Number.isFinite(valor) ? valor : padrao;

const limitar = (valor: number, limite: number) => Math.min(limite, Math.max(-limite, valor));

const datumValido = (valor: unknown): DatumTerreno =>
    valor === 'sirgas2000' || valor === 'sad69' ? valor : 'auto';

const coordenadaOuNula = (valor: unknown, minimo: number, maximo: number) =>
    typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo
        ? valor
        : null;

export function lerConfiguracaoTerreno(): ConfiguracaoTerreno {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_CONFIGURACAO) || '{}');
        // Ajustes manuais gravados antes da calibração BIM compensavam o erro
        // antigo da grade. Aplicá-los sobre a correção nova duplicaria o
        // deslocamento; a migração os zera uma única vez.
        const configuracaoAtual = salvo.versaoGeorreferenciamento === VERSAO_GEOREFERENCIAMENTO;
        return {
            latitude: configuracaoAtual ? coordenadaOuNula(salvo.latitude, -85, 85) : null,
            longitude: configuracaoAtual ? coordenadaOuNula(salvo.longitude, -180, 180) : null,
            zoom: Math.round(Math.min(16, Math.max(11, numeroFinito(salvo.zoom, 13)))),
            deslocamentoX: configuracaoAtual ? limitar(numeroFinito(salvo.deslocamentoX, 0), LIMITE_DESLOCAMENTO) : 0,
            deslocamentoY: configuracaoAtual ? limitar(numeroFinito(salvo.deslocamentoY, 0), LIMITE_DESLOCAMENTO) : 0,
            deslocamentoZ: configuracaoAtual ? limitar(numeroFinito(salvo.deslocamentoZ, 0), LIMITE_DESLOCAMENTO) : 0,
            rotacao: configuracaoAtual ? limitar(numeroFinito(salvo.rotacao, 0), 180) : 0,
            datum: configuracaoAtual ? datumValido(salvo.datum) : 'auto',
        };
    } catch {
        return { ...CONFIGURACAO_TERRENO_PADRAO };
    }
}

export function gravarConfiguracaoTerreno(config: ConfiguracaoTerreno) {
    try {
        localStorage.setItem(CHAVE_CONFIGURACAO, JSON.stringify({
            ...config,
            versaoGeorreferenciamento: VERSAO_GEOREFERENCIAMENTO,
        }));
    } catch { /* modo privado */ }
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

interface CalibracaoGeorreferenciamento {
    datumPadrao: 'sirgas2000' | 'sad69';
    porDatum: Record<'sirgas2000' | 'sad69', { leste: number; norte: number }>;
    cota: number;
    pontosControle: number;
}

/**
 * Calibrações comprovadas contra a topografia cotada do próprio federado.
 *
 * O NWD da Serra das Araras não transporta o código EPSG: a extensão
 * Autodesk.Geolocation retorna `hasGeolocationData=false`, e os campos
 * Latitude/Longitude dos arquivos filhos são valores padrão inválidos. Foram
 * usados os 1.088 pontos Civil 3D com Easting/Northing/Elevation presentes no
 * BIM contra o mesmo DEM da malha (correlação 0,99923 e RMSE 3,28 m).
 *
 * Os dois pares abaixo descrevem o mesmo lugar físico nos dois datums. Assim a
 * seleção manual já existente continua válida sem reintroduzir deslocamento.
 */
function calibracaoDoModelo(nome: string): CalibracaoGeorreferenciamento | null {
    if (!/116RJ[-_ ]*218[-_ ]*226/i.test(nome)) return null;
    return {
        datumPadrao: 'sad69',
        porDatum: {
            sirgas2000: { leste: -86, norte: -41 },
            sad69: { leste: -41, norte: 5 },
        },
        cota: -0.58,
        pontosControle: 1088,
    };
}

function datumDoModelo(nome: string): 'sirgas2000' | 'sad69' {
    return calibracaoDoModelo(nome)?.datumPadrao ?? 'sirgas2000';
}

interface Elipsoide {
    a: number;
    ecc: number;
}

const ELIPSOIDE_SIRGAS: Elipsoide = { a: 6378137, ecc: 0.006694380022900787 };
const ELIPSOIDE_SAD69: Elipsoide = {
    a: 6378160,
    ecc: 2 / 298.25 - 1 / 298.25 ** 2,
};
const TRANSLACAO_SAD69_SIRGAS = { x: -67.35, y: 3.88, z: -38.22 };

/** Conversão inversa UTM parametrizada pelo elipsoide do datum de origem. */
function utmParaGeograficas(
    easting: number,
    northing: number,
    zona: number,
    sul: boolean,
    elipsoide: Elipsoide,
) {
    const { a, ecc } = elipsoide;
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

/** Conversão geográfica para UTM parametrizada pelo elipsoide de destino. */
function geograficasParaUtm(
    latitude: number,
    longitude: number,
    zona: number,
    elipsoide: Elipsoide,
) {
    const { a, ecc } = elipsoide;
    const k0 = 0.9996;
    const eccLinha = ecc / (1 - ecc);
    const latitudeRad = latitude * Math.PI / 180;
    const longitudeRad = longitude * Math.PI / 180;
    const longitudeOrigemRad = ((zona - 1) * 6 - 180 + 3) * Math.PI / 180;
    const sin = Math.sin(latitudeRad);
    const cos = Math.cos(latitudeRad);
    const tan = Math.tan(latitudeRad);
    const n = a / Math.sqrt(1 - ecc * sin ** 2);
    const t = tan ** 2;
    const c = eccLinha * cos ** 2;
    const aa = cos * (longitudeRad - longitudeOrigemRad);
    const m = a * (
        (1 - ecc / 4 - 3 * ecc ** 2 / 64 - 5 * ecc ** 3 / 256) * latitudeRad
        - (3 * ecc / 8 + 3 * ecc ** 2 / 32 + 45 * ecc ** 3 / 1024) * Math.sin(2 * latitudeRad)
        + (15 * ecc ** 2 / 256 + 45 * ecc ** 3 / 1024) * Math.sin(4 * latitudeRad)
        - (35 * ecc ** 3 / 3072) * Math.sin(6 * latitudeRad)
    );
    const easting = 500000 + k0 * n * (
        aa
        + (1 - t + c) * aa ** 3 / 6
        + (5 - 18 * t + t ** 2 + 72 * c - 58 * eccLinha) * aa ** 5 / 120
    );
    let northing = k0 * (
        m + n * tan * (
            aa ** 2 / 2
            + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24
            + (61 - 58 * t + t ** 2 + 600 * c - 330 * eccLinha) * aa ** 6 / 720
        )
    );
    if (latitude < 0) northing += 10000000;
    return { easting, northing };
}

function geograficasParaGeocentricas(
    latitude: number,
    longitude: number,
    elipsoide: Elipsoide,
) {
    const lat = latitude * Math.PI / 180;
    const lon = longitude * Math.PI / 180;
    const n = elipsoide.a / Math.sqrt(1 - elipsoide.ecc * Math.sin(lat) ** 2);
    return {
        x: n * Math.cos(lat) * Math.cos(lon),
        y: n * Math.cos(lat) * Math.sin(lon),
        z: n * (1 - elipsoide.ecc) * Math.sin(lat),
    };
}

function geocentricasParaGeograficas(
    x: number,
    y: number,
    z: number,
    elipsoide: Elipsoide,
) {
    const longitude = Math.atan2(y, x);
    const p = Math.hypot(x, y);
    let latitude = Math.atan2(z, p * (1 - elipsoide.ecc));
    for (let i = 0; i < 8; i++) {
        const n = elipsoide.a / Math.sqrt(1 - elipsoide.ecc * Math.sin(latitude) ** 2);
        const altura = p / Math.cos(latitude) - n;
        latitude = Math.atan2(z, p * (1 - elipsoide.ecc * n / (n + altura)));
    }
    return {
        latitude: latitude * 180 / Math.PI,
        longitude: longitude * 180 / Math.PI,
    };
}

/** EPSG:15485 — transformação SAD69 para SIRGAS 2000 usada no Brasil. */
function sad69ParaSirgas(latitude: number, longitude: number) {
    const sad = geograficasParaGeocentricas(latitude, longitude, ELIPSOIDE_SAD69);
    return geocentricasParaGeograficas(
        sad.x + TRANSLACAO_SAD69_SIRGAS.x,
        sad.y + TRANSLACAO_SAD69_SIRGAS.y,
        sad.z + TRANSLACAO_SAD69_SIRGAS.z,
        ELIPSOIDE_SIRGAS,
    );
}

function sirgasParaSad69(latitude: number, longitude: number) {
    const sirgas = geograficasParaGeocentricas(latitude, longitude, ELIPSOIDE_SIRGAS);
    return geocentricasParaGeograficas(
        sirgas.x - TRANSLACAO_SAD69_SIRGAS.x,
        sirgas.y - TRANSLACAO_SAD69_SIRGAS.y,
        sirgas.z - TRANSLACAO_SAD69_SIRGAS.z,
        ELIPSOIDE_SAD69,
    );
}

function utmModeloParaWgs84(
    easting: number,
    northing: number,
    zona: number,
    sul: boolean,
    datum: 'sirgas2000' | 'sad69',
) {
    const geograficas = utmParaGeograficas(
        easting,
        northing,
        zona,
        sul,
        datum === 'sad69' ? ELIPSOIDE_SAD69 : ELIPSOIDE_SIRGAS,
    );
    return datum === 'sad69'
        ? sad69ParaSirgas(geograficas.latitude, geograficas.longitude)
        : geograficas;
}

function wgs84ParaUtmModelo(
    latitude: number,
    longitude: number,
    zona: number,
    datum: 'sirgas2000' | 'sad69',
) {
    const geograficas = datum === 'sad69'
        ? sirgasParaSad69(latitude, longitude)
        : { latitude, longitude };
    return geograficasParaUtm(
        geograficas.latitude,
        geograficas.longitude,
        zona,
        datum === 'sad69' ? ELIPSOIDE_SAD69 : ELIPSOIDE_SIRGAS,
    );
}

/**
 * Pares "coordenada original do projeto ↔ ponto correspondente no Viewer".
 *
 * O par precisa ser coerente nos três eixos: é ele que diz onde plantar o
 * terreno. Cada candidato carrega o próprio `offsetVerticalModelo`
 * (zModelo − zViewer) — sem isso o terreno acaba na altura do meio da caixa do
 * federado, centenas de metros acima do solo, e numa vista inclinada esse erro
 * de cota aparece como se a ortofoto estivesse deslocada no plano.
 *
 * A ordem importa: `incluir` descarta repetições, então o candidato mais
 * confiável precisa entrar primeiro.
 */
function centrosOriginaisDoModelo(viewer: any) {
    const caixa = caixaDoModelo(viewer);
    const centro = caixa.getCenter();
    const offset = viewer.model?.getData?.()?.globalOffset;
    const candidatos: Array<{
        x: number;
        y: number;
        ancoraViewer: { x: number; y: number; z: number };
        offsetVerticalModelo: number;
    }> = [];

    const incluir = (pontoModelo: any, ancoraViewer: any) => {
        const x = numero(pontoModelo?.x);
        const y = numero(pontoModelo?.y);
        if (x === null || y === null) return;
        if (candidatos.some(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01)) return;

        const zViewer = Number(ancoraViewer?.z || 0);
        candidatos.push({
            x,
            y,
            ancoraViewer: {
                x: Number(ancoraViewer?.x || 0),
                y: Number(ancoraViewer?.y || 0),
                z: zViewer,
            },
            offsetVerticalModelo: (numero(pontoModelo?.z) ?? zViewer) - zViewer,
        });
    };

    // 1) globalOffset é a própria origem do projeto dentro do Viewer, declarada
    //    pelo carregador. Não depende da caixa do federado, que traz referências
    //    espalhadas por centenas de quilômetros.
    if (offset) {
        incluir(offset, { x: 0, y: 0, z: 0 });
        incluir(
            {
                x: centro.x + Number(offset.x || 0),
                y: centro.y + Number(offset.y || 0),
                z: centro.z + Number(offset.z || 0),
            },
            centro,
        );
    }

    // 2) A transformação inversa chega ao mesmo lugar quando existe.
    try {
        const inversa = viewer.model?.getInverseModelToViewerTransform?.();
        if (inversa && (window as any).THREE) {
            incluir(new (window as any).THREE.Vector3(centro.x, centro.y, centro.z).applyMatrix4(inversa), centro);
        }
    } catch { /* transformação ausente */ }

    // 3) Último recurso: modelo carregado sem deslocamento nenhum.
    incluir(centro, centro);

    return candidatos;
}

function centroPorUtm(viewer: any, config: ConfiguracaoTerreno): CentroGeografico | null {
    const nome = nomeDoModelo(viewer);
    const uf = ufDoNome(nome);
    if (!uf) return null;

    const referencia = UFS[uf];
    const zonaDaUf = Math.floor((referencia.longitude + 180) / 6) + 1;
    const sul = referencia.latitude < 0;
    const datum = config.datum === 'auto' ? datumDoModelo(nome) : config.datum;
    const calibracao = calibracaoDoModelo(nome);
    const ajusteGrade = calibracao?.porDatum[datum] ?? { leste: 0, norte: 0 };

    // Estados grandes cruzam mais de um fuso: RJ vai do 23 ao 24, MG do 22 ao 24.
    // Testar os vizinhos evita aceitar um erro de 6° de longitude — cerca de
    // 600 km — só porque o centroide do estado ainda ficava dentro do limite.
    const zonas = [zonaDaUf, zonaDaUf - 1, zonaDaUf + 1].filter(z => z >= 18 && z <= 25);

    let melhor: {
        latitude: number;
        longitude: number;
        score: number;
        ancoraViewer: { x: number; y: number; z: number };
        easting: number;
        northing: number;
        zona: number;
        offsetVerticalModelo: number;
    } | null = null;

    for (const ponto of centrosOriginaisDoModelo(viewer)) {
        if (ponto.x < 100000 || ponto.x > 900000) continue;
        // Projetos rodoviários costumam truncar o milhão do northing.
        const northings = ponto.y >= 1000000
            ? [ponto.y]
            : [6, 7, 8, 9].map(milhao => ponto.y + milhao * 1000000);

        for (const northing of northings) {
            if (northing < 0 || northing > 10000000) continue;
            for (const zona of zonas) {
                // A âncora continua no ponto original do Viewer. A correção
                // atua somente na grade usada para buscar/reprojetar o terreno.
                const eastingGeografico = ponto.x + ajusteGrade.leste;
                const northingGeografico = northing + ajusteGrade.norte;
                const convertido = utmModeloParaWgs84(
                    eastingGeografico,
                    northingGeografico,
                    zona,
                    sul,
                    datum,
                );
                if (!coordenadaValida(convertido.latitude, convertido.longitude)) continue;
                const score = Math.abs(convertido.latitude - referencia.latitude) * 1.5
                    + Math.abs(convertido.longitude - referencia.longitude);
                if (!melhor || score < melhor.score) {
                    melhor = {
                        ...convertido,
                        score,
                        ancoraViewer: ponto.ancoraViewer,
                        easting: eastingGeografico,
                        northing: northingGeografico,
                        zona,
                        offsetVerticalModelo: ponto.offsetVerticalModelo,
                    };
                }
            }
        }
    }

    // Impede que uma coordenada cartesiana qualquer seja aceita só porque
    // numericamente cabe na faixa UTM do estado.
    if (!melhor || melhor.score > 7) return null;
    return {
        latitude: melhor.latitude,
        longitude: melhor.longitude,
        automatica: true,
        origem: `UTM ${melhor.zona}${sul ? 'S' : 'N'} · ${datum === 'sad69' ? 'SAD69' : 'SIRGAS 2000'}`
            + (calibracao ? ` · calibrado por ${calibracao.pontosControle.toLocaleString('pt-BR')} pontos BIM` : ''),
        ancoraViewer: melhor.ancoraViewer,
        utm: { easting: melhor.easting, northing: melhor.northing, zona: melhor.zona, sul, datum },
        offsetVerticalModelo: melhor.offsetVerticalModelo,
        correcaoVerticalBim: calibracao?.cota,
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

async function resolverCentro(viewer: any, config: ConfiguracaoTerreno): Promise<CentroGeografico> {
    if ((config.latitude === null) !== (config.longitude === null)) {
        throw new Error('Informe latitude e longitude juntas ou deixe ambas vazias para a detecção automática.');
    }
    if (config.latitude !== null && config.longitude !== null) {
        return { latitude: config.latitude, longitude: config.longitude, automatica: false, origem: 'coordenadas informadas' };
    }

    // O federado da obra usa coordenadas UTM no próprio NWD. Esta leitura é
    // imediata e precisa vir antes de extensões e metadados potencialmente
    // grandes, evitando bloquear a interface do Viewer.
    const utm = centroPorUtm(viewer, config);
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

function tileParaLongitude(x: number, zoom: number) {
    return x / 2 ** zoom * 360 - 180;
}

function tileParaLatitude(y: number, zoom: number) {
    const mercator = Math.PI - 2 * Math.PI * y / 2 ** zoom;
    return Math.atan(Math.sinh(mercator)) * 180 / Math.PI;
}

async function carregarElevacao(z: number, x: number, y: number, signal: AbortSignal): Promise<LercData> {
    const resposta = await fetch(ELEVACAO_URL(z, x, y), { signal });
    if (!resposta.ok) throw new Error(`elevação ${z}/${x}/${y} indisponível (${resposta.status})`);

    const Lerc = await prepararLerc();
    abortado(signal);
    return Lerc.decode(await resposta.arrayBuffer());
}

async function carregarTextura(
    THREE: any,
    z: number,
    x: number,
    y: number,
    resolucao: number | null,
    signal: AbortSignal,
) {
    const urlImagem = resolucao
        ? IMAGEM_ALTA_URL(z, x, y, resolucao)
        : IMAGEM_TILE_URL(z, x, y);
    const resposta = await fetch(urlImagem, { signal });
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
        textura.generateMipmaps = true;
        textura.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearMipMapLinearFilter || THREE.LinearFilter;
        textura.magFilter = THREE.LinearFilter;
        textura.anisotropy = 4;
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

interface ContextoMalha {
    tileXFlutuante: number;
    tileYFlutuante: number;
    tamanhoTile: number;
    zoom: number;
    metrosPorUnidade: number;
    elevacaoReferencia: number;
    /** Origem no espaço do Viewer, já corrigida verticalmente para a cota do solo. */
    origem: { x: number; y: number; z: number };
    referenciaUtm?: {
        easting: number;
        northing: number;
        zona: number;
        sul: boolean;
        datum: 'sirgas2000' | 'sad69';
    };
}

/** Quantos segmentos usar para um tile, acompanhando a resolução do relevo recebido. */
function segmentosDoTile(dados: LercData) {
    const amostras = Number(dados?.width) || 0;
    return Math.min(SEGMENTOS_MAX, Math.max(SEGMENTOS_MIN, amostras - 1));
}

/**
 * Coordenadas de cada vértice relativas à âncora, antes da calibração:
 * [leste, norte, desnível] por vértice, em unidades do modelo.
 *
 * É a parte cara — uma reprojeção UTM por vértice — e não depende do ajuste
 * fino. Fica em cache para que mover o terreno na mão seja só uma soma.
 */
function calcularBase(
    dados: LercData,
    tileX: number,
    tileY: number,
    contexto: ContextoMalha,
) {
    const {
        tileXFlutuante, tileYFlutuante, tamanhoTile, zoom,
        metrosPorUnidade, elevacaoReferencia, referenciaUtm,
    } = contexto;

    const segmentos = segmentosDoTile(dados);
    const base = new Float32Array((segmentos + 1) ** 2 * 3);
    let ultimaElevacao = elevacaoReferencia;
    let i = 0;

    for (let linha = 0; linha <= segmentos; linha++) {
        const v = linha / segmentos;
        for (let coluna = 0; coluna <= segmentos; coluna++) {
            const u = coluna / segmentos;
            const elevacaoLida = amostrar(dados, u, v);
            const elevacao = Number.isFinite(elevacaoLida) ? elevacaoLida : ultimaElevacao;
            ultimaElevacao = elevacao;

            if (referenciaUtm) {
                const longitude = tileParaLongitude(tileX + u, zoom);
                const latitude = tileParaLatitude(tileY + v, zoom);
                const utm = wgs84ParaUtmModelo(
                    latitude,
                    longitude,
                    referenciaUtm.zona,
                    referenciaUtm.datum,
                );
                base[i++] = (utm.easting - referenciaUtm.easting) / metrosPorUnidade;
                base[i++] = (utm.northing - referenciaUtm.northing) / metrosPorUnidade;
            } else {
                // Reserva para modelos encontrados por latitude/longitude, sem
                // coordenadas UTM originais disponíveis.
                base[i++] = (tileX - tileXFlutuante + u) * tamanhoTile / metrosPorUnidade;
                base[i++] = -(tileY - tileYFlutuante + v) * tamanhoTile / metrosPorUnidade;
            }
            base[i++] = (elevacao - elevacaoReferencia) / metrosPorUnidade;
        }
    }

    return base;
}

/** Aplica rotação, deslocamento e âncora sobre as coordenadas em cache. */
function calcularPosicoes(
    base: Float32Array,
    contexto: ContextoMalha,
    config: ConfiguracaoTerreno,
    destino?: Float32Array,
) {
    const { metrosPorUnidade, origem } = contexto;
    const posicoes = destino ?? new Float32Array(base.length);
    const angulo = config.rotacao * Math.PI / 180;
    const cos = Math.cos(angulo);
    const sin = Math.sin(angulo);
    const dx = origem.x + config.deslocamentoX / metrosPorUnidade;
    const dy = origem.y + config.deslocamentoY / metrosPorUnidade;
    const dz = origem.z + config.deslocamentoZ / metrosPorUnidade;

    for (let i = 0; i < base.length; i += 3) {
        const leste = base[i];
        const norte = base[i + 1];
        posicoes[i] = dx + leste * cos - norte * sin;
        posicoes[i + 1] = dy + leste * sin + norte * cos;
        posicoes[i + 2] = dz + base[i + 2];
    }

    return posicoes;
}

function montarMalha(
    THREE: any,
    dados: LercData,
    textura: any,
    base: Float32Array,
    contexto: ContextoMalha,
    config: ConfiguracaoTerreno,
) {
    const segmentos = segmentosDoTile(dados);
    const lado = segmentos + 1;
    const uvs = new Float32Array(lado * lado * 2);

    let k = 0;
    for (let linha = 0; linha < lado; linha++) {
        const v = 1 - linha / segmentos;
        for (let coluna = 0; coluna < lado; coluna++) {
            uvs[k++] = coluna / segmentos;
            uvs[k++] = v;
        }
    }

    // Acima de 65.535 vértices o índice de 16 bits estoura silenciosamente e a
    // malha sai embaralhada. Com 256 segmentos são 66.049 por tile.
    const totalVertices = lado * lado;
    const indices = totalVertices > 65535
        ? new Uint32Array(segmentos * segmentos * 6)
        : new Uint16Array(segmentos * segmentos * 6);

    let j = 0;
    for (let linha = 0; linha < segmentos; linha++) {
        for (let coluna = 0; coluna < segmentos; coluna++) {
            const a = linha * lado + coluna;
            const b = a + 1;
            const c = a + lado;
            const d = c + 1;
            indices[j++] = a; indices[j++] = c; indices[j++] = b;
            indices[j++] = b; indices[j++] = c; indices[j++] = d;
        }
    }

    const geometria = new THREE.BufferGeometry();
    atributo(geometria, 'position', new THREE.BufferAttribute(calcularPosicoes(base, contexto, config), 3));
    atributo(geometria, 'uv', new THREE.BufferAttribute(uvs, 2));
    const indice = new THREE.BufferAttribute(indices, 1);
    if (geometria.setIndex) geometria.setIndex(indice); else atributo(geometria, 'index', indice);
    geometria.computeVertexNormals?.();
    geometria.computeBoundingSphere?.();

    const material = new THREE.MeshBasicMaterial({
        map: textura,
        side: THREE.DoubleSide,
        // Apenas esta malha recebe transparência. O material do NWD nunca é
        // alterado, portanto a modelagem permanece opaca e legível.
        opacity: OPACIDADE_INICIAL,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
    });
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
    const alvoCamera = viewer.navigation?.getTarget?.();
    const fallback = alvoCamera || caixa.getCenter();
    // A caixa do federado contém referências deslocadas centenas de km. A
    // âncora derivada do globalOffset é a origem real do trecho UTM no Viewer.
    const origem = centro.ancoraViewer
        ? { ...centro.ancoraViewer }
        : { x: fallback.x, y: fallback.y, z: fallback.z };
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

    if (centro.offsetVerticalModelo !== undefined) {
        // Planta o terreno na cota real do solo, convertida para o espaço do
        // Viewer pela mesma relação que o carregador aplicou ao modelo
        // (zViewer = zModelo − offsetVertical).
        //
        // Sem isto o terreno fica na altura do centro da caixa do federado, que
        // é o meio da faixa de elevação da serra — centenas de metros acima do
        // chão. Numa vista inclinada esse erro de cota se manifesta como se a
        // ortofoto estivesse deslocada no plano, que é o sintoma percebido.
        origem.z = elevacaoReferencia / metrosPorUnidade - centro.offsetVerticalModelo;
    }
    if (centro.correcaoVerticalBim) {
        origem.z += centro.correcaoVerticalBim / metrosPorUnidade;
    }

    const contexto: ContextoMalha = {
        tileXFlutuante, tileYFlutuante, tamanhoTile, zoom,
        metrosPorUnidade, elevacaoReferencia, origem,
        referenciaUtm: centro.utm,
    };
    let configAtual = config;

    const cena = `${CENA}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (viewer.overlays?.addScene) viewer.overlays.addScene(cena);
    else viewer.impl.createOverlayScene(cena);
    const malhas: any[] = [];
    const detalhesMalhas: Array<{
        malha: any; dx: number; dy: number; x: number; y: number;
        base: Float32Array;
    }> = [];
    const controleAltaResolucao = new AbortController();
    let removido = false;
    const definirOpacidade = (valor: number) => {
        const opacidade = Math.min(1, Math.max(0, Number.isFinite(valor) ? valor : OPACIDADE_INICIAL));
        // Totalmente opaco deixa de ser um caso de mistura: passa a escrever
        // profundidade, senão o terreno some atrás de si mesmo nas dobras do
        // relevo, já que a ordem de desenho dos tiles não segue a câmera.
        const opaco = opacidade >= 1;
        for (const malha of malhas) {
            const material = malha.material;
            material.opacity = opacidade;
            material.transparent = !opaco;
            material.depthWrite = opaco;
            material.needsUpdate = true;
        }
        viewer.impl.invalidate?.(true, true, true);
    };
    /**
     * Recalcula as posições dos vértices com a nova calibração. Relevo e
     * textura ficam onde estão, então o ajuste é instantâneo e sem rede.
     */
    const ajustar = (novo: ConfiguracaoTerreno) => {
        if (removido) return;
        configAtual = novo;
        for (const detalhe of detalhesMalhas) {
            const atributoPosicao = detalhe.malha.geometry.getAttribute?.('position')
                ?? detalhe.malha.geometry.attributes?.position;
            if (!atributoPosicao) continue;
            // Escreve direto no buffer existente: nada de realocar 200 mil
            // vértices por clique no ajuste fino.
            calcularPosicoes(detalhe.base, contexto, novo, atributoPosicao.array as Float32Array);
            atributoPosicao.needsUpdate = true;
            detalhe.malha.geometry.computeBoundingSphere?.();
        }
        viewer.impl.invalidate?.(true, true, true);
    };
    const remover = () => {
        if (removido) return;
        removido = true;
        controleAltaResolucao.abort();
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
                    // O tile de 256 px aparece rapidamente. A substituição por
                    // alta resolução acontece em segundo plano após a montagem.
                    carregarTextura(THREE, zoom, x, y, null, signal),
                ]);
                abortado(signal);
                if (removido) { textura.dispose?.(); return; }
                const base = calcularBase(dados, tileCentralX + dx, tileCentralY + dy, contexto);
                const malha = montarMalha(THREE, dados, textura, base, contexto, configAtual);
                malhas.push(malha);
                detalhesMalhas.push({ malha, dx, dy, x, y, base });
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

        // Prioriza o centro e melhora uma textura por vez. O usuário já pode
        // navegar enquanto a imagem ganha definição, sem uma tela bloqueada.
        const aprimorarTexturas = async () => {
            const ordenadas = [...detalhesMalhas].sort((a, b) =>
                Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
            for (const detalhe of ordenadas) {
                if (removido || controleAltaResolucao.signal.aborted) return;
                const resolucao = detalhe.dx === 0 && detalhe.dy === 0
                    ? RESOLUCAO_TEXTURA_CENTRAL
                    : RESOLUCAO_TEXTURA_BASE;
                try {
                    const textura = await carregarTextura(
                        THREE, zoom, detalhe.x, detalhe.y, resolucao,
                        controleAltaResolucao.signal,
                    );
                    if (removido) { textura.dispose?.(); return; }
                    const anterior = detalhe.malha.material.map;
                    detalhe.malha.material.map = textura;
                    detalhe.malha.material.needsUpdate = true;
                    detalhe.malha.userData.elosResolucaoTextura = resolucao;
                    anterior?.dispose?.();
                    viewer.impl.invalidate?.(false, false, true);
                } catch {
                    if (controleAltaResolucao.signal.aborted) return;
                    // Mantém o tile rápido já visível caso a versão detalhada
                    // esteja temporariamente indisponível.
                }
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            }
        };
        void aprimorarTexturas();

        return {
            latitude: centro.latitude,
            longitude: centro.longitude,
            localizacaoAutomatica: centro.automatica,
            origemLocalizacao: centro.origem,
            datumUsado: centro.utm?.datum
                ?? (config.datum === 'auto' ? 'sirgas2000' : config.datum),
            definirOpacidade,
            ajustar,
            remover,
        };
    } catch (erro) {
        remover();
        throw erro;
    }
}
