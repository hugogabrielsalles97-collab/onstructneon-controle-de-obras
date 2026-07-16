// ─── VISUAL PAVIMENTO ───────────────────────────────────────────────
// Pacotes de serviço de pavimentação, em ordem de execução, com rampa de cor
// clara (1ª camada) → escura (última camada). Cada trecho mostra a cor do
// serviço mais avançado já executado ali (a camada mais escura sobrepõe as claras).

export interface ServiceLayer {
    key: string;
    label: string;
    color: string;
    /** Palavras-chave para casar com o título da tarefa (nomes podem variar). */
    match: (titleLower: string) => boolean;
}

export const SERVICE_LAYERS: ServiceLayer[] = [
    { key: 'cft',    label: 'CFT',       color: '#bfe3ff', match: t => /\bcft\b/.test(t) },
    { key: 'macadame', label: 'Macadame', color: '#7fbfe6', match: t => /macadame/.test(t) },
    { key: 'bgtc',   label: 'BGTC',      color: '#4f97c9', match: t => /bgtc/.test(t) },
    { key: 'bgmc',   label: 'BGMC',      color: '#2f6fa8', match: t => /bgmc/.test(t) },
    { key: 'cbuq1',  label: 'CBUQ 1°',   color: '#264f74', match: t => /cbuq/.test(t) && /(1|1ª|1°|primeir)/.test(t) },
    { key: 'cbuq2',  label: 'CBUQ 2°',   color: '#101f33', match: t => /cbuq/.test(t) && /(2|2ª|2°|segund)/.test(t) },
];

/** Índice da camada (0..5) a partir do título; -1 se não for um dos serviços. */
export function detectServiceIndex(title: string): number {
    const t = (title || '').toLowerCase();
    // CBUQ 2 antes de CBUQ 1 para não confundir; camadas mais específicas primeiro
    for (let i = SERVICE_LAYERS.length - 1; i >= 0; i--) {
        if (SERVICE_LAYERS[i].match(t)) return i;
    }
    return -1;
}

export interface EstacaPoint { est: number; x: number; y: number; }
export interface Calibration { pageW: number; pageH: number; aspect: number; laneA: EstacaPoint[]; laneB: EstacaPoint[]; }

/** Pista pelo número da estaca: 3xxxx = A, 4xxxx = B. */
export function laneOf(est: number): 'A' | 'B' | null {
    if (est >= 30000 && est < 40000) return 'A';
    if (est >= 40000 && est < 50000) return 'B';
    return null;
}

/** Interpola a posição (x,y) de uma estaca arbitrária ao longo do traçado calibrado. */
export function positionAt(points: EstacaPoint[], est: number): { x: number; y: number } | null {
    if (!points.length) return null;
    if (est <= points[0].est) return { x: points[0].x, y: points[0].y };
    if (est >= points[points.length - 1].est) {
        const p = points[points.length - 1];
        return { x: p.x, y: p.y };
    }
    for (let i = 1; i < points.length; i++) {
        if (est <= points[i].est) {
            const a = points[i - 1], b = points[i];
            const t = (est - a.est) / (b.est - a.est || 1);
            return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
    }
    return null;
}

/**
 * Polilinha (lista de {x,y}) do traçado entre duas estacas, seguindo a via curva.
 * Inclui os pontos calibrados intermediários para acompanhar a curvatura.
 */
export function pathBetween(points: EstacaPoint[], from: number, to: number): { x: number; y: number }[] {
    if (!points.length || to <= from) return [];
    const start = positionAt(points, from);
    const end = positionAt(points, to);
    if (!start || !end) return [];
    const mids = points.filter(p => p.est > from && p.est < to).map(p => ({ x: p.x, y: p.y }));
    return [start, ...mids, end];
}
