/**
 * Mapa de avanÃ§o real: pinta o pavimento conforme o que jÃ¡ foi executado.
 *
 * Cruza trÃªs coisas:
 *   1. os rÃ³tulos de estaca do modelo (utils/estacasModelo.ts)
 *   2. a posiÃ§Ã£o de cada elemento de pavimento, pela caixa envolvente
 *   3. as tarefas de pavimentaÃ§Ã£o do ELOS, que trabalham por faixa de estacas
 *
 * O resultado Ã© a obra pintada por serviÃ§o concluÃ­do, em vez do projeto.
 */

import { supabase } from '../supabaseClient';
import { ESTACAS_MODELO } from '../utils/estacasModelo';
import { SERVICOS_PAVIMENTACAO, servicoDaCamada } from './viewerPavimentacao';
import { PropriedadesPeca } from './viewerPropriedades';

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
    /** Faixa lida de cada campo, para expor divergÃªncias entre eles. */
    fontes: { titulo: [number, number] | null; local: [number, number] | null; corte: [number, number] | null };
    divergente: boolean;
}

export interface ResumoAvanco {
    porServico: Record<string, { concluido: number; andamento: number; semTarefa: number }>;
    tarefasUsadas: number;
    estacasLocalizadas: number;
    semEstaca: number;
    /** Elementos que receberam o cinza de base. Zero denuncia que nÃ£o pegou. */
    cinzaAplicado: number;
    /** PeÃ§as de revestimento de tabuleiro pintadas, dentro das OAEs. */
    tabuleirosPintados: number;
    /** PeÃ§as posicionadas pelo estaqueamento declarado no prÃ³prio projeto. */
    porPropriedade: number;
    /** PeÃ§as que precisaram de projeÃ§Ã£o geomÃ©trica por falta desse dado. */
    porGeometria: number;
    /** PeÃ§as pintadas em pedaÃ§os, por fragmento. */
    pintadasPorFragmento: number;
    /** PeÃ§as de fragmento Ãºnico, que sÃ³ podem receber uma cor. */
    pintadasInteiras: number;
}

/** Mesma regra do utils/constants: duas primeiras estacas de 5â€“6 dÃ­gitos. */
const extrairFaixa = (texto?: string | null): [number, number] | null => {
    if (!texto) return null;
    const nums = (String(texto).match(/\d{5,6}/g) || []).map(Number).filter(Number.isFinite);
    if (nums.length === 0) return null;
    if (nums.length === 1) return [nums[0], nums[0]];
    return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
};

/** Descobre o serviÃ§o a partir do tÃ­tulo da tarefa. */
const servicoDoTitulo = (titulo: string): string | null => {
    const t = titulo.toUpperCase();
    // CBUQ antes de BGTC/BGMC porque "CBUQ 2Âª" e afins nÃ£o devem cair em outro.
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

            // A estaca aparece no tÃ­tulo, no location (formato novo) ou no
            // corte (legado), e os trÃªs nem sempre concordam. Usar sÃ³ um deles
            // encurtava trechos: uma tarefa de 31066-31085 no tÃ­tulo tinha
            // 31066-31078 no corte, e o pedaÃ§o da frente ficava sem pintura.
            //
            // A faixa usada Ã© a uniÃ£o, e a divergÃªncia fica registrada para
            // aparecer no cartÃ£o â€” Ã© dado a corrigir no ELOS, nÃ£o a esconder.
            const fontes = {
                titulo: extrairFaixa(t.title),
                local: extrairFaixa(t.location),
                corte: extrairFaixa(t.corte),
            };

            const encontradas = [fontes.titulo, fontes.local, fontes.corte].filter(Boolean) as [number, number][];
            if (encontradas.length === 0) continue;

            const faixa: [number, number] = [
                Math.min(...encontradas.map(f => f[0])),
                Math.max(...encontradas.map(f => f[1])),
            ];

            const divergente = encontradas.some(f => f[0] !== faixa[0] || f[1] !== faixa[1]);

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
                fontes,
                divergente,
            });
        }

        offset += 500;
    }

    return tarefas;
}

/** Cinza do modelo: tudo que nÃ£o for informaÃ§Ã£o de avanÃ§o fica assim. */
const CINZA_BASE: [number, number, number] = [0.62, 0.62, 0.62];

/**
 * Ordem construtiva do pavimento, de baixo para cima.
 *
 * As camadas sÃ£o empilhadas, entÃ£o de cima sÃ³ se enxerga a Ãºltima. A cor vai
 * sempre na superfÃ­cie de CBUQ, indicando o serviÃ§o mais avanÃ§ado jÃ¡ concluÃ­do
 * naquele trecho â€” Ã© isso que dÃ¡ a leitura do estÃ¡gio real da obra.
 */
export const ORDEM_SERVICOS = ['CFT', 'Macadame', 'BGTC', 'BGMC', 'CBUQ'] as const;

/** Camada que recebe a cor: a superfÃ­cie, que Ã© o que se vÃª. */
const SERVICO_SUPERFICIE = 'CBUQ';

/**
 * Ordena estÃ¡gios: mais adiante na sequÃªncia construtiva vence, e concluÃ­do
 * vence em andamento do mesmo serviÃ§o.
 */
const posicaoDoEstagio = (e: { servico: string; concluido: boolean }) =>
    ORDEM_SERVICOS.indexOf(e.servico as any) * 2 + (e.concluido ? 1 : 0);

/**
 * FraÃ§Ã£o mÃ­nima da peÃ§a que a tarefa precisa cobrir para colori-la.
 *
 * A peÃ§a Ã© indivisÃ­vel: ou a tarefa responde pela maior parte dela, ou pintÃ¡-la
 * inteira declara avanÃ§o em metros que nÃ£o foram executados.
 */
const COBERTURA_MINIMA = 0.5;

/**
 * Revestimento sobre o tabuleiro das obras de arte.
 *
 * Sobre as pontes o pavimento nÃ£o vem no arquivo de pavimentaÃ§Ã£o: quem modelou
 * o colocou dentro da prÃ³pria OAE, como `CCR_Pavimento`. Sem isso o mapa de
 * avanÃ§o ficava interrompido em cada viaduto, mesmo com o CBUQ executado.
 *
 * Deliberadamente nÃ£o inclui `CCR_LajeMoldadaInLoco` nem `CCR_LajeDeLigacao`:
 * sÃ£o a laje estrutural sob o revestimento, e pintÃ¡-las coloriria a estrutura
 * como se fosse pavimento.
 */
const PADRAO_TABULEIRO = /CCR_Pavimento/i;

/**
 * Deixa o modelo inteiro cinza, para o avanÃ§o ser a Ãºnica informaÃ§Ã£o colorida.
 *
 * Pintado elemento por elemento, e nÃ£o por propagaÃ§Ã£o recursiva a partir da
 * raiz: a propagaÃ§Ã£o depende da versÃ£o do Viewer e nÃ£o pegou aqui, deixando o
 * modelo cru com as cores dos 77 arquivos de origem. TambÃ©m nÃ£o dÃ¡ para usar
 * filtro CSS de escala de cinza, porque ele age sobre o canvas inteiro e
 * dessaturaria justamente as cores do avanÃ§o.
 *
 * Devolve quantos elementos foram pintados â€” zero significa que o cinza nÃ£o
 * pegou, e isso precisa aparecer em vez de virar uma tela colorida sem
 * explicaÃ§Ã£o.
 */
export function aplicarBaseCinza(viewer: any, excluir?: Set<number>): number {
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
            // As peÃ§as de pavimento ficam de fora: elas sÃ£o pintadas por
            // fragmento, e a cor de elemento sobrepÃµe a de fragmento.
            if (excluir?.has(id)) return;
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
 * PosiÃ§Ã£o de cada rÃ³tulo de estaca, em coordenadas do Viewer.
 *
 * Lida do prÃ³prio elemento, e nÃ£o da coordenada UTM do CAD: assim nÃ£o existe
 * conversÃ£o de sistema para errar, e um deslocamento no modelo nÃ£o desalinha
 * o mapa de avanÃ§o.
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
        } catch { /* rÃ³tulo ausente nesta versÃ£o do modelo */ }

        if (!achou || caixa.isEmpty()) continue;

        const centro = caixa.getCenter(new THREE.Vector3());
        pontos.push({ estaca, x: centro.x, y: centro.y });
    }

    return pontos;
}

/**
 * Agrupa os rÃ³tulos por eixo e ordena por estaca, formando a poligonal de cada
 * um. O eixo Ã© o primeiro dÃ­gito do rÃ³tulo de 5 posiÃ§Ãµes.
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
 * Estaca de um ponto, por projeÃ§Ã£o sobre a poligonal do eixo.
 *
 * Encaixar no rÃ³tulo mais prÃ³ximo nÃ£o serve: os rÃ³tulos estÃ£o de 5 em 5
 * estacas, e uma peÃ§a na borda da pista fica lateralmente afastada do eixo â€”
 * numa curva, o rÃ³tulo mais prÃ³ximo dela pode ser o do trecho vizinho. A
 * projeÃ§Ã£o dÃ¡ a estaca correta independentemente do afastamento lateral, e
 * interpola entre rÃ³tulos em vez de arredondar.
 *
 * Entre os eixos, vence o de menor distÃ¢ncia perpendicular.
 */
function estacaProjetada(
    eixos: Map<number, PontoEstaca[]>,
    x: number,
    y: number,
    somenteEixo?: number
): { estaca: number; distancia: number; eixo: number } | null {
    let melhorEstaca: number | null = null;
    let melhorEixo = 0;
    let menorDistancia = Infinity;

    for (const [eixo, pontos] of eixos.entries()) {
        if (somenteEixo !== undefined && eixo !== somenteEixo) continue;
        for (let i = 0; i < pontos.length - 1; i++) {
            const a = pontos[i];
            const b = pontos[i + 1];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const comprimento = dx * dx + dy * dy;
            if (comprimento === 0) continue;

            // FraÃ§Ã£o da projeÃ§Ã£o sobre o segmento, presa ao trecho.
            let t = ((x - a.x) * dx + (y - a.y) * dy) / comprimento;
            t = Math.max(0, Math.min(1, t));

            const px = a.x + t * dx;
            const py = a.y + t * dy;
            const distancia = (px - x) ** 2 + (py - y) ** 2;

            if (distancia < menorDistancia) {
                menorDistancia = distancia;
                melhorEstaca = Math.round(a.estaca + t * (b.estaca - a.estaca));
                melhorEixo = eixo;
            }
        }
    }

    return melhorEstaca === null
        ? null
        : { estaca: melhorEstaca, distancia: Math.sqrt(menorDistancia), eixo: melhorEixo };
}

export interface AmostraFragmento {
    fragId: number;
    estaca: number;
}

/**
 * Estaca de cada fragmento de uma peÃ§a, projetada no eixo informado.
 *
 * Fixar o eixo pela propriedade do projeto elimina a Ãºnica fraqueza sÃ©ria da
 * projeÃ§Ã£o geomÃ©trica: onde as pistas se aproximam â€” chegam a 18 m â€”, um
 * fragmento podia cair mais perto do eixo da pista vizinha.
 */
function posicoesDosFragmentos(
    tree: any,
    frags: any,
    THREE: any,
    eixos: Map<number, PontoEstaca[]>,
    dbId: number,
    eixoFixo: number | null
): AmostraFragmento[] {
    const centros: { fragId: number; x: number; y: number }[] = [];

    try {
        tree.enumNodeFragments(dbId, (fragId: number) => {
            const caixa = new THREE.Box3();
            frags.getWorldBounds(fragId, caixa);
            if (caixa.isEmpty()) return;

            const centro = caixa.getCenter(new THREE.Vector3());
            centros.push({ fragId, x: centro.x, y: centro.y });
        }, true);
    } catch {
        return [];
    }

    if (centros.length === 0) return [];

    // Sem eixo declarado, decide por maioria entre os fragmentos.
    let eixo = eixoFixo;
    if (eixo === null || !eixos.has(eixo)) {
        const votos = new Map<number, number>();
        for (const c of centros) {
            const p = estacaProjetada(eixos, c.x, c.y);
            if (p) votos.set(p.eixo, (votos.get(p.eixo) || 0) + 1);
        }
        if (votos.size === 0) return [];
        eixo = [...votos.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    const amostras: AmostraFragmento[] = [];
    for (const c of centros) {
        const p = estacaProjetada(eixos, c.x, c.y, eixo);
        if (p) amostras.push({ fragId: c.fragId, estaca: p.estaca });
    }

    return amostras;
}


/**
 * Pinta os elementos de pavimento conforme o serviÃ§o executado naquela estaca.
 *
 * ConcluÃ­do fica na cor cheia; em andamento, na mesma cor esmaecida; o que nÃ£o
 * tem tarefa concluÃ­da nÃ£o recebe cor â€” some no cinza do modelo, deixando o
 * avanÃ§o legÃ­vel de longe.
 */
export function pintarAvanco(
    viewer: any,
    tarefas: TarefaPavimentacao[],
    pontos: PontoEstaca[],
    propriedades: Map<number, PropriedadesPeca>
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
        tabuleirosPintados: 0,
        porPropriedade: 0,
        porGeometria: 0,
        pintadasPorFragmento: 0,
        pintadasInteiras: 0,
    };

    if (!THREE || !tree || !frags || pontos.length === 0) return resumo;

    for (const s of SERVICOS_PAVIMENTACAO) {
        resumo.porServico[s.servico] = { concluido: 0, andamento: 0, semTarefa: 0 };
    }

    resumo.cinzaAplicado = aplicarBaseCinza(viewer);

    const eixos = montarEixos(pontos);
    const podeFragmento = typeof frags.setThemingColor === 'function';

    const corDe = (servico: string, cheia: boolean) => {
        const def = SERVICOS_PAVIMENTACAO.find(s => s.servico === servico)!;
        return new THREE.Vector4(...def.rgb, cheia ? 1 : 0.35);
    };

    /**
     * EstÃ¡gio de um trecho: o serviÃ§o mais avanÃ§ado da ordem construtiva que jÃ¡
     * foi concluÃ­do ali. Se nenhum foi concluÃ­do, cai para o mais avanÃ§ado em
     * andamento, que Ã© pintado esmaecido.
     */
    const estagioDaEstaca = (estaca: number): { servico: string; concluido: boolean } | null => {
        for (let i = ORDEM_SERVICOS.length - 1; i >= 0; i--) {
            const servico = ORDEM_SERVICOS[i];
            const cobre = tarefas.filter(t => t.servico === servico && estaca >= t.de && estaca <= t.ate);
            if (cobre.some(t => t.status === 'ConcluÃ­do' || t.progresso >= 100)) {
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


    /** Pinta cada folha da subÃ¡rvore conforme o estÃ¡gio no seu trecho. */
    const pintarSuperficie = (raiz: number, contarComoTabuleiro: boolean) => {
        tree.enumNodeChildren(raiz, (folha: number) => {
            let temFilho = false;
            tree.enumNodeChildren(folha, () => { temFilho = true; }, false);
            if (temFilho) return;

            // Cada fonte no que ela Ã© boa.
            //
            // O eixo vem da propriedade do projeto: Ã© dado escrito, e resolve a
            // troca de pista que a geometria errava onde as pistas se aproximam.
            //
            // A extensÃ£o vem da geometria: o CCR_Estaqueamento de muitas peÃ§as
            // descreve o trecho do corredor a que ela pertence, e nÃ£o o
            // comprimento dela â€” hÃ¡ peÃ§as declarando 186 estacas, quase 4 km.
            // Usar isso como extensÃ£o inflava o intervalo e reprovava tudo na
            // regra de cobertura.
            const props = propriedades.get(folha);
            const eixoDeclarado = props?.eixo ?? null;

            const posicoes = posicoesDosFragmentos(tree, frags, THREE, eixos, folha, eixoDeclarado);
            if (posicoes.length === 0) { resumo.semEstaca++; return; }

            if (eixoDeclarado !== null) resumo.porPropriedade++; else resumo.porGeometria++;

            const lista = posicoes.map(p => p.estaca);
            const faixa: [number, number] = [Math.min(...lista), Math.max(...lista)];

            if (podeFragmento && posicoes.length > 1) {
                // VÃ¡rios fragmentos: cada um tem sua prÃ³pria estaca, calculada
                // pela posiÃ§Ã£o dele, e recebe a cor do seu pedaÃ§o. Ã‰ o que
                // permite o serviÃ§o terminar no meio de uma peÃ§a longa.
                let algum = false;

                for (const { fragId, estaca } of posicoes) {
                    const estagio = estagioDaEstaca(estaca);

                    if (estagio) {
                        frags.setThemingColor(fragId, corDe(estagio.servico, estagio.concluido));
                        algum = true;
                        const c = resumo.porServico[estagio.servico];
                        if (estagio.concluido) c.concluido++; else c.andamento++;
                    } else {
                        frags.setThemingColor(fragId, new THREE.Vector4(...CINZA_BASE, 1));
                    }
                }

                if (algum) {
                    resumo.pintadasPorFragmento++;
                    if (contarComoTabuleiro) resumo.tabuleirosPintados++;
                } else {
                    resumo.porServico[SERVICO_SUPERFICIE].semTarefa++;
                }

                return;
            }

            // PeÃ§a de fragmento Ãºnico: Ã© indivisÃ­vel, entÃ£o ou a tarefa cobre a
            // maior parte dela, ou nÃ£o pintamos. SÃ³ exigir alguma cobertura
            // pintava 220 m por causa de uma estaca encostada na ponta.
            const amostrados: ({ servico: string; concluido: boolean } | null)[] = [];
            const passo = Math.max(1, Math.ceil((faixa[1] - faixa[0]) / 40));

            for (let e = faixa[0]; e <= faixa[1]; e += passo) amostrados.push(estagioDaEstaca(e));
            amostrados.push(estagioDaEstaca(faixa[1]));

            const dominante = (() => {
                for (let i = ORDEM_SERVICOS.length * 2 - 1; i >= 0; i--) {
                    const cobertos = amostrados.filter(e => e && posicaoDoEstagio(e) >= i).length;
                    if (cobertos / amostrados.length >= COBERTURA_MINIMA) {
                        return amostrados.find(e => e && posicaoDoEstagio(e) === i) ||
                            amostrados.filter(e => e && posicaoDoEstagio(e) >= i)[0]!;
                    }
                }
                return null;
            })();

            if (!dominante) {
                viewer.setThemingColor(folha, new THREE.Vector4(...CINZA_BASE, 1), model, true);
                resumo.porServico[SERVICO_SUPERFICIE].semTarefa++;
                return;
            }

            viewer.setThemingColor(folha, corDe(dominante.servico, dominante.concluido), model, true);
            resumo.pintadasInteiras++;

            const contagem = resumo.porServico[dominante.servico];
            if (dominante.concluido) contagem.concluido++; else contagem.andamento++;
            if (contarComoTabuleiro) resumo.tabuleirosPintados++;
        }, true);
    };

    // SÃ³ a superfÃ­cie recebe cor: as camadas por baixo dela nÃ£o aparecem na
    // tela, e a estrutura das OAEs nÃ£o Ã© pavimento.
    const visitar = (id: number) => {
        const nome = tree.getNodeName(id) || '';

        if (PADRAO_TABULEIRO.test(nome)) { pintarSuperficie(id, true); return; }

        const servico = servicoDaCamada(nome);
        if (servico) {
            if (servico.servico === SERVICO_SUPERFICIE) pintarSuperficie(id, false);
            return;
        }

        tree.enumNodeChildren(id, visitar, false);
    };

    visitar(tree.getRootId());
    viewer.impl.invalidate(true);

    return resumo;
}

/**
 * Junta os dbIds das peÃ§as que recebem cor: a superfÃ­cie de pavimento e o
 * revestimento dos tabuleiros. Ã‰ a lista para a qual vale a pena ler as
 * propriedades do projeto.
 */
export function coletarPecasDePavimento(viewer: any): number[] {
    const tree = viewer?.model?.getInstanceTree?.();
    if (!tree) return [];

    const pecas: number[] = [];

    const recolher = (raiz: number) => {
        tree.enumNodeChildren(raiz, (folha: number) => {
            let temFilho = false;
            tree.enumNodeChildren(folha, () => { temFilho = true; }, false);
            if (!temFilho) pecas.push(folha);
        }, true);
    };

    const visitar = (id: number) => {
        const nome = tree.getNodeName(id) || '';

        if (PADRAO_TABULEIRO.test(nome)) { recolher(id); return; }

        const servico = servicoDaCamada(nome);
        if (servico) {
            if (servico.servico === SERVICO_SUPERFICIE) recolher(id);
            return;
        }

        tree.enumNodeChildren(id, visitar, false);
    };

    visitar(tree.getRootId());
    return pecas;
}

/**
 * Devolve uma funÃ§Ã£o que diz a estaca de qualquer elemento do modelo.
 *
 * Usa exatamente o mesmo cÃ¡lculo da pintura â€” projeÃ§Ã£o sobre o eixo â€” para que
 * a informaÃ§Ã£o mostrada no clique nunca divirja da cor que estÃ¡ na tela.
 */
export function criarLocalizadorDeEstaca(
    viewer: any,
    pontos: PontoEstaca[],
    propriedades: Map<number, PropriedadesPeca>
) {
    const THREE = (window as any).THREE;
    const model = viewer?.model;
    const tree = model?.getInstanceTree?.();
    const frags = model?.getFragmentList?.();
    const eixos = montarEixos(pontos);

    // Mesma composiÃ§Ã£o de fontes da pintura, para o cartÃ£o nunca discordar da
    // cor: eixo do projeto, extensÃ£o da geometria.
    return (dbId: number): [number, number] | null => {
        if (!THREE || !tree || !frags) return null;

        const eixoDeclarado = propriedades.get(dbId)?.eixo ?? null;
        const posicoes = posicoesDosFragmentos(tree, frags, THREE, eixos, dbId, eixoDeclarado);
        if (posicoes.length === 0) return null;

        const lista = posicoes.map(p => p.estaca);
        return [Math.min(...lista), Math.max(...lista)];
    };
}

export interface OrigemElemento {
    /** Camada do CAD, um nÃ­vel abaixo do arquivo de origem. */
    camada: string | null;
    /** Arquivo de origem dentro do federado. */
    arquivo: string | null;
    /** ServiÃ§o de pavimentaÃ§Ã£o, quando a camada for uma das pintadas. */
    servico: string | null;
}

/**
 * De onde vem um elemento: arquivo de origem e camada.
 *
 * Sempre devolve o que achou, mesmo fora das camadas de pavimentaÃ§Ã£o. Antes eu
 * sÃ³ retornava camada conhecida, e um elemento de outro arquivo aparecia sem
 * qualquer identificaÃ§Ã£o â€” o que escondia justamente o motivo de ele nÃ£o ter
 * sido pintado.
 */
export function camadaDoElemento(viewer: any, dbId: number): OrigemElemento {
    const tree = viewer?.model?.getInstanceTree?.();
    const vazio: OrigemElemento = { camada: null, arquivo: null, servico: null };
    if (!tree) return vazio;

    // Sobe atÃ© a raiz guardando o caminho, para ler arquivo e camada por posiÃ§Ã£o.
    const caminho: string[] = [];
    let atual = dbId;

    for (let i = 0; i < 32 && atual; i++) {
        caminho.push(tree.getNodeName(atual) || `#${atual}`);
        const pai = tree.getNodeParentId(atual);
        if (!pai || pai === atual) break;
        atual = pai;
    }

    // caminho vai do elemento atÃ© a raiz; o arquivo Ã© o penÃºltimo nÃ­vel.
    const daRaiz = [...caminho].reverse();
    const arquivo = daRaiz.length > 1 ? daRaiz[1] : null;
    const camada = daRaiz.length > 2 ? daRaiz[2] : null;

    const conhecida = caminho.find(n => servicoDaCamada(n));

    return {
        camada: conhecida || camada,
        arquivo,
        servico: conhecida ? servicoDaCamada(conhecida)!.servico : null,
    };
}
