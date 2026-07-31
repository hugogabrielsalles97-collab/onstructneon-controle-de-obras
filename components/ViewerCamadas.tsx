import React, { useMemo, useState } from 'react';

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

interface Props {
    camadas: Camada[];
    ocultos: Set<number>;
    onAlternar: (id: number) => void;
    onPreset: (ids: number[]) => void;
    aberto: boolean;
    onFechar: () => void;
}

/** Disciplinas de cadastro e anotação — o que o preset "só projeto novo" tira. */
export const PADRAO_CADASTRO = /-M[BF]-(C1|D4|F1|Q1|Z9)-/i;

/** Camadas volumosas que são projeto, mas atrapalham a leitura de conjunto. */
export const PADRAO_RUIDO = /TACHAS|LEGENDAS|LOGO|HACHURA/i;

/**
 * Ids do preset "só projeto novo": arquivos de cadastro inteiros, mais as
 * camadas de ruído que estão dentro de arquivos de projeto.
 */
export function idsSoProjetoNovo(camadas: Camada[]): number[] {
    const ids: number[] = [];

    for (const c of camadas) {
        if (PADRAO_CADASTRO.test(c.nome)) { ids.push(c.id); continue; }
        for (const f of c.filhos) if (PADRAO_RUIDO.test(f.nome)) ids.push(f.id);
    }

    return ids;
}

const formatar = (n: number) => n.toLocaleString('pt-BR');

const ViewerCamadas: React.FC<Props> = ({ camadas, ocultos, onAlternar, onPreset, aberto, onFechar }) => {
    const [busca, setBusca] = useState('');
    const [expandido, setExpandido] = useState<Set<number>>(new Set());

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

    const idsCadastro = useMemo(
        () => camadas.filter(c => PADRAO_CADASTRO.test(c.nome)).map(c => c.id),
        [camadas]
    );

    const idsProjetoNovo = useMemo(() => idsSoProjetoNovo(camadas), [camadas]);

    if (!aberto) return null;

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

    return (
        <div className="absolute top-0 right-0 z-20 flex h-full w-80 max-w-[85vw] flex-col border-l border-gray-800 bg-brand-darkest/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-200">Camadas do modelo</h3>
                <button onClick={onFechar} className="text-gray-500 hover:text-gray-200" aria-label="Fechar">✕</button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-800 px-4 py-3">
                <button
                    onClick={() => onPreset(idsProjetoNovo)}
                    className="rounded bg-cyan-600/20 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-600/30"
                >
                    Só projeto novo
                </button>
                <button
                    onClick={() => onPreset(idsCadastro)}
                    className="rounded bg-gray-800 px-2 py-1 text-[11px] text-gray-300 hover:bg-gray-700"
                >
                    Sem cadastro
                </button>
                <button
                    onClick={() => onPreset([])}
                    className="rounded bg-gray-800 px-2 py-1 text-[11px] text-gray-300 hover:bg-gray-700"
                >
                    Mostrar tudo
                </button>
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

            <div className="border-t border-gray-800 px-4 py-2 text-[10px] text-gray-600">
                {ocultos.size > 0 ? `${ocultos.size} camada(s) oculta(s)` : 'Tudo visível'} — a escolha fica salva neste navegador
            </div>
        </div>
    );
};

export default ViewerCamadas;
