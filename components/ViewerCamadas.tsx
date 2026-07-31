import React, { useMemo, useState } from 'react';
import { SERVICOS_PAVIMENTACAO } from './viewerPavimentacao';
import type { ResumoAvanco } from './viewerAvanco';

/**
 * Painel de camadas do federado.
 *
 * O modelo reúne 77 arquivos de origem e 683 mil elementos. Boa parte é
 * cadastro (árvores, cercas, curvas de nível), anotação (estacas, logos) ou
 * elemento repetido em massa (316 mil tachas) — coisas que escondem a obra
 * nova numa vista geral. Aqui o usuário decide o que fica.
 */

export interface Camada {
    id: number;
    nome: string;
    quantidade: number;
    filhos: Camada[];
}

/** Disciplinas de cadastro e anotação — o que o preset "só projeto novo" tira. */
export const PADRAO_CADASTRO = /-M[BF]-(C1|D4|F1|Q1|Z9)-/i;

/** Camadas volumosas que são projeto, mas atrapalham a leitura de conjunto. */
export const PADRAO_RUIDO = /TACHAS|LEGENDAS|LOGO|HACHURA/i;

/**
 * Pavimentação (I2) e obras de arte especiais (L2).
 *
 * L4 fica de fora de propósito: apesar do código vizinho, esses arquivos são
 * contenções — solo grampeado, gabião e solo reforçado. Os grampos aparecem
 * como um leque de barras saindo do talude e poluem a vista de pista e OAE.
 */
export const PADRAO_PISTAS_OAE = /-M[BF]-(I2|L2)-/i;

/** Contenções: solo grampeado, gabiões, solo reforçado. */
export const PADRAO_CONTENCAO = /-M[BF]-L4-/i;

const CHAVE_LAYOUTS = 'elos.viewer.layoutsSalvos';

/**
 * Versão das regras de preset. Subir este número descarta os layouts que o
 * usuário salvou antes.
 *
 * Existe porque um layout salvo tem precedência sobre a regra automática: sem
 * o descarte, corrigir a definição de um preset não teria efeito nenhum para
 * quem já tivesse gravado a versão errada — e o bug pareceria não corrigido.
 *
 * v2: L4 saiu de "Pistas e OAEs" (é contenção, não obra de arte).
 */
const VERSAO_LAYOUTS = 2;

export function idsSoProjetoNovo(camadas: Camada[]): number[] {
    const ids: number[] = [];

    for (const c of camadas) {
        if (PADRAO_CADASTRO.test(c.nome)) { ids.push(c.id); continue; }
        for (const f of c.filhos) if (PADRAO_RUIDO.test(f.nome)) ids.push(f.id);
    }

    return ids;
}

/** Esconde tudo que não for pista ou OAE. */
export function idsPistasEOae(camadas: Camada[]): number[] {
    return camadas.filter(c => !PADRAO_PISTAS_OAE.test(c.nome)).map(c => c.id);
}

export interface Preset {
    chave: string;
    rotulo: string;
    descricao: string;
    calcular: (camadas: Camada[]) => number[];
}

export const PRESETS: Preset[] = [
    {
        chave: 'projeto-novo',
        rotulo: 'Só projeto novo',
        descricao: 'Tira cadastro, anotação e as 316.402 tachas',
        calcular: idsSoProjetoNovo,
    },
    {
        chave: 'pistas-oae',
        rotulo: 'Pistas e OAEs',
        descricao: 'Só pavimentação (I2) e obras de arte especiais (L2)',
        calcular: idsPistasEOae,
    },
    {
        chave: 'contencoes',
        rotulo: 'Contenções',
        descricao: 'Só solo grampeado, gabiões e solo reforçado (L4)',
        calcular: (camadas) => camadas.filter(c => !PADRAO_CONTENCAO.test(c.nome)).map(c => c.id),
    },
    {
        chave: 'sem-cadastro',
        rotulo: 'Sem cadastro',
        descricao: 'Tira só os arquivos de levantamento existente',
        calcular: (camadas) => camadas.filter(c => PADRAO_CADASTRO.test(c.nome)).map(c => c.id),
    },
    {
        chave: 'tudo',
        rotulo: 'Mostrar tudo',
        descricao: 'Nenhuma camada oculta',
        calcular: () => [],
    },
];

// --- Layouts salvos pelo usuário: sobrepõem o cálculo padrão do preset.

export type LayoutsSalvos = Record<string, number[]>;

export const lerLayouts = (): LayoutsSalvos => {
    try {
        const bruto = localStorage.getItem(CHAVE_LAYOUTS);
        if (!bruto) return {};

        const parsed = JSON.parse(bruto);
        // Formato antigo (sem versão) ou versão vencida: descarta.
        if (parsed?.versao !== VERSAO_LAYOUTS) return {};

        return parsed.dados || {};
    } catch {
        return {};
    }
};

const gravarLayouts = (layouts: LayoutsSalvos) => {
    try {
        localStorage.setItem(CHAVE_LAYOUTS, JSON.stringify({ versao: VERSAO_LAYOUTS, dados: layouts }));
    } catch { /* modo privado */ }
};

/**
 * Ids de um preset: o que o usuário salvou tem precedência sobre a regra
 * automática. É o que permite gravar os elementos apagados um a um dentro de
 * "Só projeto novo" e reencontrá-los na próxima visita.
 */
export function idsDoPreset(preset: Preset, camadas: Camada[], layouts: LayoutsSalvos): number[] {
    const salvo = layouts[preset.chave];
    return salvo ? salvo : preset.calcular(camadas);
}

const mesmoConjunto = (a: Set<number>, b: number[]) =>
    a.size === b.length && b.every(id => a.has(id));

/**
 * Qual preset corresponde ao estado atual. Comparar o conjunto, em vez de
 * lembrar o último botão clicado, mantém a indicação honesta quando o usuário
 * mexe numa camada solta.
 */
export function presetAtivo(camadas: Camada[], ocultos: Set<number>, layouts: LayoutsSalvos): string | null {
    for (const p of PRESETS) if (mesmoConjunto(ocultos, idsDoPreset(p, camadas, layouts))) return p.chave;
    return null;
}

interface Props {
    camadas: Camada[];
    ocultos: Set<number>;
    onAlternar: (id: number) => void;
    onPreset: (ids: number[]) => void;
    resumoAvanco: ResumoAvanco | null;
    carregandoCor: boolean;
    erroCor: string | null;
    onRecarregarAvanco: () => void;
    aberto: boolean;
    onFechar: () => void;
}

const formatar = (n: number) => n.toLocaleString('pt-BR');

const ViewerCamadas: React.FC<Props> = ({
    camadas, ocultos, onAlternar, onPreset,
    resumoAvanco, carregandoCor, erroCor, onRecarregarAvanco,
    aberto, onFechar,
}) => {
    const [busca, setBusca] = useState('');
    const [expandido, setExpandido] = useState<Set<number>>(new Set());
    const [layouts, setLayouts] = useState<LayoutsSalvos>(() => lerLayouts());
    const [salvoAgora, setSalvoAgora] = useState<string | null>(null);

    const filtradas = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        if (!termo) return camadas;

        return camadas
            .map(c => {
                if (c.nome.toLowerCase().includes(termo)) return c;
                const filhos = c.filhos.filter(f => f.nome.toLowerCase().includes(termo));
                return filhos.length ? { ...c, filhos } : null;
            })
            .filter(Boolean) as Camada[];
    }, [camadas, busca]);

    const ativo = useMemo(() => presetAtivo(camadas, ocultos, layouts), [camadas, ocultos, layouts]);

    if (!aberto) return null;

    const salvarNoLayout = (chave: string) => {
        const proximo = { ...layouts, [chave]: [...ocultos] };
        setLayouts(proximo);
        gravarLayouts(proximo);
        setSalvoAgora(chave);
        setTimeout(() => setSalvoAgora(null), 1800);
    };

    const restaurarPadroes = () => {
        setLayouts({});
        gravarLayouts({});
    };

    const alternarExpansao = (id: number) => {
        setExpandido(prev => {
            const proximo = new Set(prev);
            if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
            return proximo;
        });
    };

    const Caixa: React.FC<{ marcado: boolean }> = ({ marcado }) => (
        <span
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                marcado ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-gray-600 text-transparent'
            }`}
        >
            ✓
        </span>
    );

    const temCustomizacao = Object.keys(layouts).length > 0;

    return (
        <div className="absolute top-0 right-0 z-20 flex h-full w-80 max-w-[85vw] flex-col border-l border-gray-800 bg-brand-darkest/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-200">Camadas do modelo</h3>
                <button onClick={onFechar} className="text-gray-500 hover:text-gray-200" aria-label="Fechar">✕</button>
            </div>

            <div className="border-b border-gray-800 px-4 py-3">
                <div className="grid grid-cols-2 gap-1.5">
                    {PRESETS.map(p => {
                        const selecionado = ativo === p.chave;
                        const customizado = Boolean(layouts[p.chave]);

                        return (
                            <div
                                key={p.chave}
                                className={`flex items-center rounded transition-colors ${
                                    selecionado ? 'bg-cyan-600/25 ring-1 ring-cyan-500' : 'bg-gray-800'
                                }`}
                            >
                                <button
                                    onClick={() => onPreset(idsDoPreset(p, camadas, layouts))}
                                    title={customizado ? `${p.descricao} (layout salvo por você)` : p.descricao}
                                    aria-pressed={selecionado}
                                    className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-[11px] ${
                                        selecionado ? 'text-cyan-200' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    <span className={selecionado ? 'text-cyan-400' : 'text-transparent'}>●</span>
                                    <span className="truncate">{p.rotulo}</span>
                                    {customizado && <span className="text-[9px] text-amber-500" title="layout salvo">★</span>}
                                </button>

                                {p.chave !== 'tudo' && (
                                    <button
                                        onClick={() => salvarNoLayout(p.chave)}
                                        title={`Gravar a vista atual (camadas e elementos apagados) em "${p.rotulo}"`}
                                        className="px-1.5 py-1.5 text-[10px] text-gray-600 hover:text-cyan-300"
                                    >
                                        {salvoAgora === p.chave ? '✓' : '💾'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {ativo === null && (
                    <p className="mt-2 text-[10px] text-gray-500">
                        Personalizado — use 💾 para gravar esta vista num layout
                    </p>
                )}

                {temCustomizacao && (
                    <button onClick={restaurarPadroes} className="mt-2 text-[10px] text-gray-600 underline hover:text-gray-400">
                        Restaurar layouts originais
                    </button>
                )}
            </div>

            <div className="border-b border-gray-800 px-4 py-2">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] text-gray-400">Avanço da pavimentação</p>
                    <button
                        onClick={onRecarregarAvanco}
                        disabled={carregandoCor}
                        title="Reler as tarefas e repintar"
                        className="text-[10px] text-gray-600 hover:text-cyan-300 disabled:opacity-40"
                    >
                        {carregandoCor ? '...' : '↻'}
                    </button>
                </div>

                {/* Estado sempre visível: uma seção em branco não diz se o
                    cruzamento falhou, está rodando ou nunca começou. */}
                <p className="mt-1 text-[10px] text-gray-500">
                    {carregandoCor
                        ? 'Cruzando tarefas com estacas...'
                        : resumoAvanco
                            ? 'Aplicado.'
                            : 'Ainda não executado — use ↻ para aplicar.'}
                </p>

                {erroCor && <p className="mt-1 text-[10px] text-red-400">{erroCor}</p>}

                {resumoAvanco && !carregandoCor && (
                    <>
                        <ul className="mt-2 space-y-1">
                            {SERVICOS_PAVIMENTACAO.map(s => {
                                const av = resumoAvanco.porServico?.[s.servico];

                                return (
                                    <li key={s.servico} className="flex items-center gap-2 text-[10px]">
                                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.cor }} />
                                        <span className="text-gray-300">{s.servico}</span>
                                        <span className="ml-auto text-gray-500">
                                            {av ? `${formatar(av.concluido)} concl. · ${formatar(av.andamento)} em and.` : '—'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>

                        <p className="mt-2 text-[10px] text-gray-600">
                            A cor vai na superfície de CBUQ e indica o serviço mais avançado já
                            concluído naquele trecho. Cor cheia = concluído; esmaecida = em andamento.
                        </p>

                        <p className="mt-1 text-[10px] text-gray-600">
                            {resumoAvanco.tarefasUsadas} tarefa(s) cruzadas.
                            {resumoAvanco.tabuleirosPintados > 0 &&
                                ` Inclui ${formatar(resumoAvanco.tabuleirosPintados)} peça(s) de tabuleiro de OAE.`}
                        </p>

                        <p className="mt-1 text-[10px] text-gray-600">
                            {formatar(resumoAvanco.porPropriedade)} peça(s) posicionada(s) pelo estaqueamento do
                            projeto
                            {resumoAvanco.porGeometria > 0 &&
                                `, ${formatar(resumoAvanco.porGeometria)} por projeção no eixo`}
                            .
                        </p>

                        <p className={`mt-1 text-[10px] ${resumoAvanco.cinzaAplicado ? 'text-gray-600' : 'text-amber-500'}`}>
                            {resumoAvanco.cinzaAplicado
                                ? `${formatar(resumoAvanco.cinzaAplicado)} elemento(s) em cinza de base.`
                                : 'O cinza de base não foi aplicado — o modelo está com as cores originais.'}
                        </p>
                    </>
                )}
            </div>

            <div className="border-b border-gray-800 px-4 py-2">
                <input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar camada..."
                    className="w-full rounded bg-gray-900 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-cyan-600"
                />
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
                {filtradas.map(camada => {
                    const oculto = ocultos.has(camada.id);
                    const aberta = expandido.has(camada.id) || Boolean(busca);

                    return (
                        <div key={camada.id} className="mb-0.5">
                            <div className="flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-gray-800/60">
                                <button
                                    onClick={() => alternarExpansao(camada.id)}
                                    className={`w-3 text-[10px] text-gray-600 ${camada.filhos.length ? 'hover:text-gray-300' : 'invisible'}`}
                                >
                                    {aberta ? '▾' : '▸'}
                                </button>

                                <button
                                    onClick={() => onAlternar(camada.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    title={camada.nome}
                                >
                                    <Caixa marcado={!oculto} />
                                    <span className={`truncate text-xs ${oculto ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                                        {camada.nome}
                                    </span>
                                    <span className="ml-auto shrink-0 text-[10px] text-gray-600">{formatar(camada.quantidade)}</span>
                                </button>
                            </div>

                            {aberta && camada.filhos.map(filho => {
                                const filhoOculto = ocultos.has(filho.id) || oculto;

                                return (
                                    <button
                                        key={filho.id}
                                        onClick={() => onAlternar(filho.id)}
                                        disabled={oculto}
                                        className="ml-6 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded px-2 py-1 text-left hover:bg-gray-800/60 disabled:opacity-40"
                                        title={filho.nome}
                                    >
                                        <Caixa marcado={!filhoOculto} />
                                        <span className={`truncate text-[11px] ${filhoOculto ? 'text-gray-600 line-through' : 'text-gray-400'}`}>
                                            {filho.nome}
                                        </span>
                                        <span className="ml-auto shrink-0 text-[10px] text-gray-700">{formatar(filho.quantidade)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}

                {filtradas.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-gray-600">Nenhuma camada encontrada.</p>
                )}
            </div>

            <div className="space-y-1 border-t border-gray-800 px-4 py-2 text-[10px] text-gray-600">
                <p>
                    Clique num elemento e tecle <kbd className="rounded border border-gray-700 bg-gray-800 px-1 text-gray-400">Delete</kbd> para ocultá-lo.
                </p>
                <p>
                    {ocultos.size > 0 ? `${ocultos.size} item(ns) oculto(s)` : 'Tudo visível'} — salvo neste navegador.
                    {ocultos.size > 0 && ' Use "Mostrar tudo" para restaurar.'}
                </p>
            </div>
        </div>
    );
};

export default ViewerCamadas;
