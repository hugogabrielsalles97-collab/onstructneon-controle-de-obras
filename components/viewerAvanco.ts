/**
 * Mapa de avanço real: pinta o pavimento conforme o que já foi executado.
 *
 * Cruza três coisas:
 *   1. os rótulos de estaca do modelo (utils/estacasModelo.ts)
 *   2. a posição de cada elemento de pavimento, pela caixa envolvente
 *   3. as tarefas de pavimentação do ELOS, que trabalham por faixa de estacas
 *
 * O resultado é a obra pintada por serviço concluído, em vez do projeto.
 */

import { supabase } from '../supabaseClient';
import { ESTACAS_MODELO } from '../utils/estacasModelo';
import { SERVICOS_PAVIMENTACAO, servicoDaCamada } from './viewerPavimentacao';

export interface TarefaPavimentacao {
    id: string;
    servico: string;
    de: number;
    ate: number;
    status: string;
    progresso: number;
    titulo: string;
    responsavel: string;
    local: string;
    inicioPrevisto: string | null;
    fimPrevisto: string | null;
    fimReal: string | null;
    quantidade: number | null;
    unidade: string | null;
    observacoes: string | null;
    fotos: string[];
}

export interface ResumoAvanco {
    porServico: Record<string, { concluido: number; andamento: number; semTarefa: number }>;
    tarefasUsadas: number;
    estacasLocalizadas: number;
    semEstaca: number;
    /** Elementos que receberam o cinza de base. Zero denuncia que não pegou. */
    cinzaAplicado: number;
}

/** Mesma regra do utils/constants: duas primeiras estacas de 5–6 dígitos. */
const extrairFaixa = (texto?: string | null): [number, number] | null => {
    if (!texto) return null;
    const nums = (String(texto).match(/\d{5,6}/g) || []).map(Number).filter(Number.isFinite);
    if (nums.length === 0) return null;
    if (nums.length === 1) return [nums[0], nums[0]];
    return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
};

/** Descobre o serviço a partir do título da tarefa. */
const servicoDoTitulo = (titulo: string): string | null => {
    const t = titulo.toUpperCase();
    // CBUQ antes de BGTC/BGMC porque "CBUQ 2ª" e afins não devem cair em outro.
    if (t.includes('CBUQ') || t.includes('CAUQ')) return 'CBUQ';
    if (t.includes('BGTC')) return 'BGTC';
    if (t.includes('BGMC')) return 'BGMC';
    if (t.includes('MACADAME')) return 'Macadame';
    if (t.includes('CFT')) return 'CFT';
    return null;
};

export async function carregarTarefasPavimentacao(): Promise<TarefaPavimentacao[]> {
    const tarefas: TarefaPavimentacao[] = [];
    let offset = 0;

    while (true) {
        const { data, error } = await supabase
            .from('tasks')
            .select('id, title, discipline, location, corte, status, progress, assignee, startDate, dueDate, actualEndDate, quantity, unit, observations, photos')
            .order('id', { ascending: true })
            .range(offset, offset + 499);

        if (error) throw new Error(`Falha ao ler tarefas: ${error.message}`);
        if (!data || data.length === 0) break;

        for (const t of data) {
            if (!/paviment/i.test(t.discipline || '')) continue;

            const servico = servicoDoTitulo(t.title || '');
            if (!servico) continue;

            // A estaca mora em location (formato novo) ou em corte (legado).
            const faixa = extrairFaixa(t.location) || extrairFaixa(t.corte);
            if (!faixa) continue;

            tarefas.push({
                id: String(t.id),
                servico,
                de: faixa[0],
                ate: faixa[1],
                status: t.status || '',
                progresso: Number(t.progress) || 0,
                titulo: t.title || '',
                responsavel: t.assignee || '',
                local: t.location || '',
                inicioPrevisto: t.startDate || null,
                fimPrevisto: t.dueDate || null,
                fimReal: t.actualEndDate || null,
                quantidade: t.quantity ?? null,
                unidade: t.unit || null,
                observacoes: t.observations || null,
                fotos: Array.isArray(t.photos) ? t.photos.filter((p: unknown) => typeof p === 'string') : [],
            });
        }

        offset += 500;
    }

    return tarefas;
}

/** Cinza do modelo: tudo que não for informação de avanço fica assim. */
const CINZA_BASE: [number, number, number] = [0.62, 0.62, 0.62];

/**
 * Ordem construtiva do pavimento, de baixo para cima.
 *
 * As camadas são empilhadas, então de cima só se enxerga a última. A cor vai
 * sempre na superfície de CBUQ, indicando o serviço mais avançado já concluído
 * naquele trecho — é isso que dá a leitura do estágio real da obra.
 */
export const ORDEM_SERVICOS = ['CFT', 'Macadame', 'BGTC', 'BGMC', 'CBUQ'] as const;

/** Camada que recebe a cor: a superfície, que é o que se vê. */
const SERVICO_SUPERFICIE = 'CBUQ';

/**
 * Deixa o modelo inteiro cinza, para o avanço ser a única informação colorida.
 *
 * Pintado elemento por elemento, e não por propagação recursiva a partir da
 * raiz: a propagação depende da versão do Viewer e não pegou aqui, deixando o
 * modelo cru com as cores dos 77 arquivos de origem. Também não dá para usar
 * filtro CSS de escala de cinza, porque ele age sobre o canvas inteiro e
 * dessaturaria justamente as cores do avanço.
 *
 * Devolve quantos elementos foram pintados — zero significa que o cinza não
 * pegou, e isso precisa aparecer em vez de virar uma tela colorida sem
 * explicação.
 */
export function aplicarBaseCinza(viewer: any): number {
    const THREE = (window as any).THREE;
    const model = viewer?.model;
    const tree = model?.getInstanceTree?.();
    if (!THREE || !tree) return 0;

    const cinza = new THREE.Vector4(...CINZA_BASE, 1);
    const raiz = tree.getRootId();
    let pintados = 0;

    const semFilhos = (id: number): boolean => {
        if (typeof tree.getChildCount === 'function') return tree.getChildCount(id) === 0;
        let tem = false;
        tree.enumNodeChildren(id, () => { tem = true; }, false);
        return !tem;
    };

    tree.enumNodeChildren(
        raiz,
        (id: number) => {
            if (!semFilhos(id)) return;
            viewer.setThemingColor(id, cinza, model, false);
            pintados++;
        },
        true
    );

    viewer.impl.invalidate(true);
    return pintados;
}

export interface PontoEstaca { estaca: number; x: number; y: number; }

/**
 * Posição de cada rótulo de estaca, em coordenadas do Viewer.
 *
 * Lida do próprio elemento, e não da coordenada UTM do CAD: assim não existe
 * conversão de sistema para errar, e um deslocamento no modelo não desalinha
 * o mapa de avanço.
 */
export function localizarEstacas(viewer: any): PontoEstaca[] {
    const THREE = (window as any).THREE;
    const model = viewer?.model;
    const tree = model?.getInstanceTree?.();
    const frags = model?.getFragmentList?.();
    if (!THREE || !tree || !frags) return [];

    const pontos: PontoEstaca[] = [];

    for (const { objectid, estaca } of ESTACAS_MODELO) {
        const caixa = new THREE.Box3();
        let achou = false;

        try {
            tree.enumNodeFragments(objectid, (fragId: number) => {
                const b = new THREE.Box3();
                frags.getWorldBounds(fragId, b);
                caixa.union(b);
                achou = true;
            }, true);
        } catch { /* rótulo ausente nesta versão do modelo */ }

        if (!achou || caixa.isEmpty()) continue;

        const centro = caixa.getCenter(new THREE.Vector3());
        pontos.push({ estaca, x: centro.x, y: centro.y });
    }

    return pontos;
}

/**
 * Agrupa os rótulos por eixo e ordena por estaca, formando a poligonal de cada
 * um. O eixo é o primeiro dígito do rótulo de 5 posições.
 */
function montarEixos(pontos: PontoEstaca[]): Map<number, PontoEstaca[]> {
    const eixos = new Map<number, PontoEstaca[]>();

    for (const p of pontos) {
        const eixo = Math.floor(p.estaca / 10000);
        if (!eixos.has(eixo)) eixos.set(eixo, []);
        eixos.get(eixo)!.push(p);
    }

    for (const lista of eixos.values()) lista.sort((a, b) => a.estaca - b.estaca);
    return eixos;
}

/**
 * Estaca de um ponto, por projeção sobre a poligonal do eixo.
 *
 * Encaixar no rótulo mais próximo não serve: os rótulos estão de 5 em 5
 * estacas, e uma peça na borda da pista fica lateralmente afastada do eixo —
 * numa curva, o rótulo mais próximo dela pode ser o do trecho vizinho. A
 * projeção dá a estaca correta independentemente do afastamento lateral, e
 * interpola entre rótulos em vez de arredondar.
 *
 * Entre os eixos, vence o de menor distância perpendicular.
 */
function estacaProjetada(eixos: Map<number, PontoEstaca[]>, x: number, y: number): number | null {
    let melhorEstaca: number | null = null;
    let menorDistancia = Infinity;

    for (const pontos of eixos.values()) {
        for (let i = 0; i < pontos.length - 1; i++) {
            const a = pontos[i];
            const b = pontos[i + 1];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const comprimento = dx * dx + dy * dy;
            if (comprimento === 0) continue;

            // Fração da projeção sobre o segmento, presa ao trecho.
            let t = ((x - a.x) * dx + (y - a.y) * dy) / comprimento;
            t = Math.max(0, Math.min(1, t));

            const px = a.x + t * dx;
            const py = a.y + t * dy;
            const distancia = (px - x) ** 2 + (py - y) ** 2;

            if (distancia < menorDistancia) {
                menorDistancia = distancia;
                melhorEstaca = Math.round(a.estaca + t * (b.estaca - a.estaca));
            }
        }
    }

    return melhorEstaca;
}

/**
 * Pinta os elementos de pavimento conforme o serviço executado naquela estaca.
 *
 * Concluído fica na cor cheia; em andamento, na mesma cor esmaecida; o que não
 * tem tarefa concluída não recebe cor — some no cinza do modelo, deixando o
 * avanço legível de longe.
 */
export function pintarAvanco(
    viewer: any,
    tarefas: TarefaPavimentacao[],
    pontos: PontoEstaca[]
): ResumoAvanco {
    const THREE = (window as any).THREE;
    const model = viewer?.model;
    const tree = model?.getInstanceTree?.();
    const frags = model?.getFragmentList?.();

    const resumo: ResumoAvanco = {
        porServico: {},
        tarefasUsadas: tarefas.length,
        estacasLocalizadas: pontos.length,
        semEstaca: 0,
        cinzaAplicado: 0,
    };

    if (!THREE || !tree || !frags || pontos.length === 0) return resumo;

    for (const s of SERVICOS_PAVIMENTACAO) {
        resumo.porServico[s.servico] = { concluido: 0, andamento: 0, semTarefa: 0 };
    }

    resumo.cinzaAplicado = aplicarBaseCinza(viewer);

    const eixos = montarEixos(pontos);

    const corDe = (servico: string, cheia: boolean) => {
        const def = SERVICOS_PAVIMENTACAO.find(s => s.servico === servico)!;
        return new THREE.Vector4(...def.rgb, cheia ? 1 : 0.35);
    };

    /**
     * Estágio de um trecho: o serviço mais avançado da ordem construtiva que já
     * foi concluído ali. Se nenhum foi concluído, cai para o mais avançado em
     * andamento, que é pintado esmaecido.
     */
    const estagioDaEstaca = (estaca: number): { servico: string; concluido: boolean } | null => {
        for (let i = ORDEM_SERVICOS.length - 1; i >= 0; i--) {
            const servico = ORDEM_SERVICOS[i];
            const cobre = tarefas.filter(t => t.servico === servico && estaca >= t.de && estaca <= t.ate);
            if (cobre.some(t => t.status === 'Concluído' || t.progresso >= 100)) {
                return { servico, concluido: true };
            }
        }

        for (let i = ORDEM_SERVICOS.length - 1; i >= 0; i--) {
            const servico = ORDEM_SERVICOS[i];
            const cobre = tarefas.filter(t => t.servico === servico && estaca >= t.de && estaca <= t.ate);
            if (cobre.length > 0) return { servico, concluido: false };
        }

        return null;
    };

    // Só a camada de superfície recebe cor: as demais ficam por baixo dela e
    // pintá-las não mudaria nada na tela.
    const visitar = (id: number) => {
        const nome = tree.getNodeName(id) || '';
        const servico = servicoDaCamada(nome);

        if (!servico) {
            tree.enumNodeChildren(id, visitar, false);
            return;
        }

        if (servico.servico !== SERVICO_SUPERFICIE) return;

        tree.enumNodeChildren(id, (folha: number) => {
            let temFilho = false;
            tree.enumNodeChildren(folha, () => { temFilho = true; }, false);
            if (temFilho) return;

            const caixa = new THREE.Box3();
            tree.enumNodeFragments(folha, (fragId: number) => {
                const b = new THREE.Box3();
                frags.getWorldBounds(fragId, b);
                caixa.union(b);
            }, true);

            if (caixa.isEmpty()) { resumo.semEstaca++; return; }

            const centro = caixa.getCenter(new THREE.Vector3());
            const estaca = estacaProjetada(eixos, centro.x, centro.y);
            if (estaca === null) { resumo.semEstaca++; return; }

            const estagio = estagioDaEstaca(estaca);
            if (!estagio) { resumo.porServico[SERVICO_SUPERFICIE].semTarefa++; return; }

            viewer.setThemingColor(folha, corDe(estagio.servico, estagio.concluido), model, true);

            const contagem = resumo.porServico[estagio.servico];
            if (estagio.concluido) contagem.concluido++; else contagem.andamento++;
        }, true);
    };

    visitar(tree.getRootId());
    viewer.impl.invalidate(true);

    return resumo;
}

/**
 * Devolve uma função que diz a estaca de qualquer elemento do modelo.
 *
 * Usa exatamente o mesmo cálculo da pintura — projeção sobre o eixo — para que
 * a informação mostrada no clique nunca divirja da cor que está na tela.
 */
export function criarLocalizadorDeEstaca(viewer: any, pontos: PontoEstaca[]) {
    const THREE = (window as any).THREE;
    const model = viewer?.model;
    const tree = model?.getInstanceTree?.();
    const frags = model?.getFragmentList?.();
    const eixos = montarEixos(pontos);

    return (dbId: number): number | null => {
        if (!THREE || !tree || !frags) return null;

        const caixa = new THREE.Box3();
        try {
            tree.enumNodeFragments(dbId, (fragId: number) => {
                const b = new THREE.Box3();
                frags.getWorldBounds(fragId, b);
                caixa.union(b);
            }, true);
        } catch { return null; }

        if (caixa.isEmpty()) return null;

        const centro = caixa.getCenter(new THREE.Vector3());
        return estacaProjetada(eixos, centro.x, centro.y);
    };
}

/** Nome da camada de um elemento, subindo a árvore até achar uma conhecida. */
export function camadaDoElemento(viewer: any, dbId: number): string | null {
    const tree = viewer?.model?.getInstanceTree?.();
    if (!tree) return null;

    let atual = dbId;

    for (let i = 0; i < 8 && atual; i++) {
        const nome = tree.getNodeName(atual) || '';
        if (nome) {
            const servico = servicoDaCamada(nome);
            if (servico) return nome;
        }

        const pai = tree.getNodeParentId(atual);
        if (!pai || pai === atual) break;
        atual = pai;
    }

    return null;
}
