import React, { useState } from 'react';
import { SERVICOS_PAVIMENTACAO } from './viewerPavimentacao';
import { ORDEM_SERVICOS, TarefaPavimentacao, OrigemElemento } from './viewerAvanco';

/**
 * Cartão do elemento clicado: mostra a estaca e as tarefas do ELOS que
 * cobrem aquele trecho, com as fotos apontadas em campo.
 *
 * As tarefas vêm da mesma lista que pintou o modelo, então o que aparece aqui
 * é literalmente a origem da cor na tela — não uma segunda consulta que
 * poderia divergir.
 */

export interface SelecaoElemento {
    dbId: number;
    /** Faixa de estacas coberta pela peça. Longa demais vira vários trechos. */
    faixa: [number, number] | null;
    origem: OrigemElemento;
    tarefas: TarefaPavimentacao[];
}

interface Props {
    selecao: SelecaoElemento | null;
    onFechar: () => void;
}

const corDoServico = (servico: string) =>
    SERVICOS_PAVIMENTACAO.find(s => s.servico === servico)?.cor || '#6b7280';

const formatarData = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
};

const corDoStatus = (status: string) => {
    if (status === 'Concluído') return 'text-emerald-400';
    if (status === 'Em Andamento') return 'text-amber-400';
    return 'text-gray-500';
};

const ViewerInfoElemento: React.FC<Props> = ({ selecao, onFechar }) => {
    const [fotoAberta, setFotoAberta] = useState<string | null>(null);

    if (!selecao) return null;

    // Mesma ordem construtiva da pintura, para a leitura bater com a tela.
    const ordenadas = [...selecao.tarefas].sort(
        (a, b) => ORDEM_SERVICOS.indexOf(a.servico as any) - ORDEM_SERVICOS.indexOf(b.servico as any)
    );

    return (
        <>
            <div className="absolute bottom-3 left-3 z-20 flex max-h-[70%] w-80 max-w-[85vw] flex-col rounded-lg border border-gray-800 bg-brand-darkest/95 shadow-xl backdrop-blur">
                <div className="flex items-start justify-between border-b border-gray-800 px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-200">
                            {!selecao.faixa
                                ? 'Estaca não identificada'
                                : selecao.faixa[0] === selecao.faixa[1]
                                    ? `Estaca ${selecao.faixa[0]}`
                                    : `Estacas ${selecao.faixa[0]} a ${selecao.faixa[1]}`}
                        </p>
                        {selecao.faixa && selecao.faixa[1] - selecao.faixa[0] > 5 && (
                            <p className="text-[10px] text-gray-500">
                                Peça longa: cada trecho dela é pintado pelo seu próprio estágio.
                            </p>
                        )}
                        <p className="text-[10px] text-gray-500">
                            {selecao.origem.camada || 'camada desconhecida'}
                        </p>
                        {selecao.origem.arquivo && (
                            <p className="text-[10px] text-gray-600" title={selecao.origem.arquivo}>
                                {selecao.origem.arquivo}
                            </p>
                        )}
                        {!selecao.origem.servico && (
                            <p className="mt-1 text-[10px] text-amber-500">
                                Fora das camadas de pavimentação — este elemento não recebe cor de avanço.
                            </p>
                        )}
                    </div>
                    <button onClick={onFechar} className="text-gray-500 hover:text-gray-200" aria-label="Fechar">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {ordenadas.length === 0 && (
                        <p className="text-xs text-gray-500">
                            {!selecao.faixa
                                ? 'Não foi possível localizar este elemento no eixo — ele pode estar fora do trecho estaqueado.'
                                : 'Nenhuma tarefa de pavimentação cobre este trecho.'}
                        </p>
                    )}

                    {ordenadas.map(t => (
                        <div key={t.id} className="mb-3 border-b border-gray-800/60 pb-3 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: corDoServico(t.servico) }} />
                                <span className="text-xs font-medium text-gray-200">{t.servico}</span>
                                <span className={`ml-auto text-[10px] ${corDoStatus(t.status)}`}>
                                    {t.status}{t.progresso ? ` · ${t.progresso}%` : ''}
                                </span>
                            </div>

                            <p className="mt-1 text-[11px] text-gray-400">{t.titulo}</p>

                            <dl className="mt-1.5 space-y-0.5 text-[10px] text-gray-500">
                                <div className="flex gap-2">
                                    <dt className="w-20 shrink-0">Estacas</dt>
                                    <dd className="text-gray-400">{t.de} a {t.ate}</dd>
                                </div>
                                {t.responsavel && (
                                    <div className="flex gap-2">
                                        <dt className="w-20 shrink-0">Responsável</dt>
                                        <dd className="text-gray-400">{t.responsavel}</dd>
                                    </div>
                                )}
                                {t.local && (
                                    <div className="flex gap-2">
                                        <dt className="w-20 shrink-0">Frente</dt>
                                        <dd className="text-gray-400">{t.local}</dd>
                                    </div>
                                )}
                                {(t.inicioPrevisto || t.fimPrevisto) && (
                                    <div className="flex gap-2">
                                        <dt className="w-20 shrink-0">Previsto</dt>
                                        <dd className="text-gray-400">
                                            {formatarData(t.inicioPrevisto) || '—'} a {formatarData(t.fimPrevisto) || '—'}
                                        </dd>
                                    </div>
                                )}
                                {t.fimReal && (
                                    <div className="flex gap-2">
                                        <dt className="w-20 shrink-0">Fim real</dt>
                                        <dd className="text-emerald-400">{formatarData(t.fimReal)}</dd>
                                    </div>
                                )}
                                {t.quantidade !== null && (
                                    <div className="flex gap-2">
                                        <dt className="w-20 shrink-0">Quantidade</dt>
                                        <dd className="text-gray-400">{t.quantidade} {t.unidade || ''}</dd>
                                    </div>
                                )}
                            </dl>

                            {t.divergente && (
                                <p className="mt-1.5 rounded bg-amber-950/40 px-2 py-1 text-[10px] text-amber-500">
                                    Campos com estacas diferentes — usei a maior faixa.
                                    {t.fontes.titulo && ` Título: ${t.fontes.titulo[0]}-${t.fontes.titulo[1]}.`}
                                    {t.fontes.local && ` Local: ${t.fontes.local[0]}-${t.fontes.local[1]}.`}
                                    {t.fontes.corte && ` Corte: ${t.fontes.corte[0]}-${t.fontes.corte[1]}.`}
                                </p>
                            )}

                            {t.observacoes && (
                                <p className="mt-1.5 rounded bg-gray-900/60 px-2 py-1 text-[10px] italic text-gray-500">
                                    {t.observacoes}
                                </p>
                            )}

                            {t.fotos.length > 0 ? (
                                <div className="mt-2">
                                    <p className="mb-1 text-[10px] text-gray-500">{t.fotos.length} foto(s)</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {t.fotos.map((foto, i) => (
                                            <button
                                                key={`${t.id}-${i}`}
                                                onClick={() => setFotoAberta(foto)}
                                                className="h-12 w-12 overflow-hidden rounded border border-gray-700 hover:border-cyan-500"
                                                title="Ampliar"
                                            >
                                                <img src={foto} alt={`Foto ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-2 text-[10px] text-gray-600">Sem fotos apontadas.</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {fotoAberta && (
                <div
                    className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 p-6"
                    onClick={() => setFotoAberta(null)}
                >
                    <img
                        src={fotoAberta}
                        alt="Foto da tarefa"
                        className="max-h-full max-w-full rounded object-contain"
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        onClick={() => setFotoAberta(null)}
                        className="absolute right-4 top-4 rounded bg-gray-900/80 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-800"
                    >
                        Fechar
                    </button>
                </div>
            )}
        </>
    );
};

export default ViewerInfoElemento;
