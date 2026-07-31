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
    servico: string;
    de: number;
    ate: number;
    status: string;
    progresso: number;
    titulo: string;
}

export interface ResumoAvanco {
    porServico: Record<string, { concluido: number; andamento: number; semTarefa: number }>;
    tarefasUsadas: number;
    estacasLocalizadas: number;
    semEstaca: number;
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
            .select('title, discipline, location, corte, status, progress')
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
                servico,
                de: faixa[0],
                ate: faixa[1],
                status: t.status || '',
                progresso: Number(t.progress) || 0,
                titulo: t.title || '',
            });
        }

        offset += 500;
    }

    return tarefas;
}

interface PontoEstaca { estaca: number; x: number; y: number; }

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

/** Estaca mais próxima de um ponto. */
function estacaMaisProxima(pontos: PontoEstaca[], x: number, y: number): number | null {
    let melhor: number | null = null;
    let menor = Infinity;

    for (const p of pontos) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < menor) { menor = d; melhor = p.estaca; }
    }

    return melhor;
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
    };

    if (!THREE || !tree || !frags || pontos.length === 0) return resumo;

    for (const s of SERVICOS_PAVIMENTACAO) {
        resumo.porServico[s.servico] = { concluido: 0, andamento: 0, semTarefa: 0 };
    }

    viewer.clearThemingColors(model);

    const visitar = (id: number) => {
        const nome = tree.getNodeName(id) || '';
        const servico = servicoDaCamada(nome);

        if (!servico) {
            tree.enumNodeChildren(id, visitar, false);
            return;
        }

        const doServico = tarefas.filter(t => t.servico === servico.servico);
        const cheia = new THREE.Vector4(...servico.rgb, 1);
        const fraca = new THREE.Vector4(...servico.rgb, 0.35);
        const contagem = resumo.porServico[servico.servico];

        // Dentro da camada, cada folha é uma peça de pavimento.
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
            const estaca = estacaMaisProxima(pontos, centro.x, centro.y);
            if (estaca === null) { resumo.semEstaca++; return; }

            const cobre = doServico.filter(t => estaca >= t.de && estaca <= t.ate);

            if (cobre.some(t => t.status === 'Concluído' || t.progresso >= 100)) {
                viewer.setThemingColor(folha, cheia, model, true);
                contagem.concluido++;
            } else if (cobre.length > 0) {
                viewer.setThemingColor(folha, fraca, model, true);
                contagem.andamento++;
            } else {
                contagem.semTarefa++;
            }
        }, true);
    };

    visitar(tree.getRootId());
    viewer.impl.invalidate(true);

    return resumo;
}
