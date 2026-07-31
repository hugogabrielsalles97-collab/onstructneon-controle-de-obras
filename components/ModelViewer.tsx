/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import ViewerCamadas, { Camada, idsSoProjetoNovo } from './ViewerCamadas';

/**
 * Visualizador do modelo federado (NWD) via Autodesk Platform Services.
 *
 * O modelo não é baixado inteiro: o Viewer transmite a geometria por demanda,
 * com nível de detalhe conforme a câmera, e consulta as propriedades dos
 * elementos no servidor. É o que torna viável abrir um federado de centenas de
 * MB num tablet de canteiro.
 *
 * O token vem do Worker `elos-aps`, que exige sessão do ELOS e devolve um
 * token de escopo `viewables:read` — sem acesso a upload, tradução ou conta.
 */

declare global {
    interface Window { Autodesk?: any; }
}

const APS_WORKER_URL = (import.meta.env.VITE_APS_WORKER_URL || '').trim().replace(/\/+$/, '');

const VIEWER_VERSION = '7.*';
const VIEWER_CSS = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/style.min.css`;
const VIEWER_JS = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/viewer3D.min.js`;

/** Carrega script/estilo uma única vez, mesmo com várias montagens. */
const loadOnce = (() => {
    const pending = new Map<string, Promise<void>>();

    return (url: string, kind: 'js' | 'css'): Promise<void> => {
        if (pending.has(url)) return pending.get(url)!;

        const promise = new Promise<void>((resolve, reject) => {
            if (document.querySelector(`[data-aps="${url}"]`)) { resolve(); return; }

            const el = kind === 'js'
                ? Object.assign(document.createElement('script'), { src: url, async: true })
                : Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url });

            el.setAttribute('data-aps', url);
            el.onload = () => resolve();
            el.onerror = () => reject(new Error(`Falha ao carregar ${kind === 'js' ? 'o script' : 'o estilo'} do Viewer.`));
            document.head.appendChild(el);
        });

        pending.set(url, promise);
        return promise;
    };
})();

const CHAVE_OCULTOS = 'elos.viewer.camadasOcultas';

/**
 * Monta a lista de camadas em dois níveis: arquivo de origem e, dentro dele,
 * as camadas do CAD.
 *
 * Só descemos dois níveis de propósito. Abaixo disso são os 683 mil elementos
 * individuais, que não cabem num painel nem interessam para ligar/desligar.
 */
function construirCamadas(viewer: any): Camada[] {
    const tree = viewer?.model?.getInstanceTree?.();
    if (!tree) return [];

    const contar = (id: number) => {
        let total = 0;
        tree.enumNodeChildren(id, () => { total++; }, true);
        return total;
    };

    const filhosDiretos = (id: number) => {
        const ids: number[] = [];
        tree.enumNodeChildren(id, (filho: number) => { if (filho !== id) ids.push(filho); }, false);
        return ids;
    };

    const raiz = tree.getRootId();
    const arquivos = filhosDiretos(raiz);

    // Federado real: a raiz é o .nwd e os arquivos de origem ficam um nível abaixo.
    const base = arquivos.length === 1 ? filhosDiretos(arquivos[0]) : arquivos;

    return base.map(id => ({
        id,
        nome: tree.getNodeName(id) || `#${id}`,
        quantidade: contar(id),
        filhos: filhosDiretos(id).map(filhoId => ({
            id: filhoId,
            nome: tree.getNodeName(filhoId) || `#${filhoId}`,
            quantidade: contar(filhoId),
            filhos: [],
        })),
    }));
}

const lerOcultos = (): Set<number> => {
    try {
        const bruto = localStorage.getItem(CHAVE_OCULTOS);
        return bruto ? new Set(JSON.parse(bruto) as number[]) : new Set();
    } catch {
        return new Set();
    }
};

const gravarOcultos = (ids: Set<number>) => {
    try { localStorage.setItem(CHAVE_OCULTOS, JSON.stringify([...ids])); } catch { /* modo privado */ }
};

async function authedFetch(path: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão expirada — entre novamente para abrir o modelo.');

    const res = await fetch(`${APS_WORKER_URL}${path}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.motivo || body.error || `Falha em ${path} (${res.status}).`);

    return body;
}

const ModelViewer: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const [status, setStatus] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
    const [mensagem, setMensagem] = useState('Preparando o modelo...');

    const [camadas, setCamadas] = useState<Camada[]>([]);
    const [ocultos, setOcultos] = useState<Set<number>>(() => lerOcultos());
    const [painelAberto, setPainelAberto] = useState(false);

    /** Aplica o conjunto inteiro de uma vez: mostrar tudo e reesconder é mais
     *  barato e mais previsível do que reconciliar diferenças. */
    const aplicar = (ids: Set<number>) => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        viewer.showAll();
        if (ids.size > 0) viewer.hide([...ids]);

        setOcultos(new Set<number>(ids));
        gravarOcultos(ids);
    };

    const alternarCamada = (id: number) => {
        const proximo = new Set<number>(ocultos);
        if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
        aplicar(proximo);
    };

    const aplicarPreset = (ids: number[]) => aplicar(new Set<number>(ids));

    // O listener de teclado é registrado uma vez só; sem o ref ele enxergaria
    // para sempre o conjunto vazio do primeiro render.
    const ocultosRef = useRef(ocultos);
    useEffect(() => { ocultosRef.current = ocultos; }, [ocultos]);

    /** Selecionar um elemento e teclar Delete some com ele. */
    useEffect(() => {
        const aoTeclar = (evento: KeyboardEvent) => {
            if (evento.key !== 'Delete') return;

            // Não sequestrar a tecla enquanto o usuário digita na busca.
            const alvo = evento.target as HTMLElement | null;
            if (alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return;

            const viewer = viewerRef.current;
            const selecao: number[] = viewer?.getSelection?.() || [];
            if (!viewer || selecao.length === 0) return;

            evento.preventDefault();

            const proximo = new Set<number>(ocultosRef.current);
            for (const id of selecao) proximo.add(id);

            viewer.hide(selecao);
            viewer.clearSelection();

            setOcultos(proximo);
            gravarOcultos(proximo);
        };

        document.addEventListener('keydown', aoTeclar);
        return () => document.removeEventListener('keydown', aoTeclar);
    }, []);

    useEffect(() => {
        let cancelado = false;

        const iniciar = async () => {
            if (!APS_WORKER_URL) {
                setStatus('erro');
                setMensagem('VITE_APS_WORKER_URL não configurada — o visualizador não sabe onde pedir o token.');
                return;
            }

            try {
                setMensagem('Localizando o modelo publicado...');
                const { urn, nome } = await authedFetch('/model');
                if (cancelado) return;

                setMensagem('Carregando o visualizador...');
                await Promise.all([loadOnce(VIEWER_CSS, 'css'), loadOnce(VIEWER_JS, 'js')]);
                if (cancelado) return;

                const Autodesk = window.Autodesk;
                if (!Autodesk?.Viewing) throw new Error('O Viewer da Autodesk não ficou disponível após o carregamento.');

                setMensagem(nome ? `Abrindo ${nome}...` : 'Abrindo o modelo...');

                await new Promise<void>((resolve) => {
                    Autodesk.Viewing.Initializer(
                        {
                            // SVF clássico (derivativeV2). SVF2 usaria streamingV2.
                            env: 'AutodeskProduction',
                            api: 'derivativeV2',
                            getAccessToken: async (onToken: (t: string, exp: number) => void) => {
                                try {
                                    const { access_token, expires_in } = await authedFetch('/token');
                                    onToken(access_token, expires_in);
                                } catch (err) {
                                    if (!cancelado) {
                                        setStatus('erro');
                                        setMensagem(err instanceof Error ? err.message : String(err));
                                    }
                                }
                            },
                        },
                        () => resolve()
                    );
                });

                if (cancelado || !containerRef.current) return;

                const viewer = new Autodesk.Viewing.GuiViewer3D(containerRef.current, {
                    extensions: ['Autodesk.DocumentBrowser'],
                });

                const codigo = viewer.start();
                if (codigo > 0) throw new Error('Não foi possível iniciar o Viewer neste navegador.');

                // Por padrão o Viewer deixa um vulto translúcido no lugar do que
                // foi ocultado. Numa vista geral com dezenas de milhares de
                // elementos escondidos, esse cinza vira uma nuvem que atrapalha
                // mais do que os objetos originais.
                viewer.setGhosting(false);

                viewerRef.current = viewer;

                Autodesk.Viewing.Document.load(
                    `urn:${urn}`,
                    (doc: any) => {
                        if (cancelado) return;
                        const raiz = doc.getRoot();
                        const view = raiz.getDefaultGeometry() || raiz.search({ type: 'geometry', role: '3d' })[0];

                        if (!view) {
                            setStatus('erro');
                            setMensagem('A tradução não produziu nenhuma vista 3D.');
                            return;
                        }

                        // A árvore de objetos fica pronta depois da geometria.
                        viewer.addEventListener(
                            Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
                            () => {
                                if (cancelado) return;

                                const lista = construirCamadas(viewer);
                                setCamadas(lista);

                                // Nunca escolheu nada: abre já sem cadastro nem
                                // anotação, que é o que tapa a obra nova. Depois
                                // vale sempre a escolha salva, inclusive "tudo visível".
                                const nunca = localStorage.getItem(CHAVE_OCULTOS) === null;
                                const alvo = nunca ? new Set(idsSoProjetoNovo(lista)) : lerOcultos();

                                if (alvo.size > 0) viewer.hide([...alvo]);
                                setOcultos(alvo);
                                if (nunca) gravarOcultos(alvo);
                            },
                            { once: true }
                        );

                        viewer.loadDocumentNode(doc, view).then(() => {
                            if (!cancelado) setStatus('pronto');
                        });
                    },
                    (code: any, msg: any) => {
                        if (cancelado) return;
                        setStatus('erro');
                        setMensagem(`Falha ao abrir o modelo (${code}): ${Array.isArray(msg) ? msg.join(' ') : msg}`);
                    }
                );
            } catch (err) {
                if (cancelado) return;
                setStatus('erro');
                setMensagem(err instanceof Error ? err.message : String(err));
            }
        };

        iniciar();

        return () => {
            cancelado = true;
            if (viewerRef.current) {
                try { viewerRef.current.finish(); } catch { /* já derrubado */ }
                viewerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="relative w-full h-full bg-brand-darkest">
            <div ref={containerRef} className="absolute inset-0" />

            {status === 'pronto' && camadas.length > 0 && !painelAberto && (
                <button
                    onClick={() => setPainelAberto(true)}
                    className="absolute top-3 right-3 z-10 rounded-md border border-gray-700 bg-brand-darkest/90 px-3 py-2
                               text-xs font-medium text-gray-200 shadow-lg backdrop-blur transition-colors hover:bg-gray-800"
                >
                    Camadas
                    {ocultos.size > 0 && <span className="ml-2 text-cyan-400">{ocultos.size} oculta(s)</span>}
                </button>
            )}

            {status === 'pronto' && (
                <ViewerCamadas
                    camadas={camadas}
                    ocultos={ocultos}
                    onAlternar={alternarCamada}
                    onPreset={aplicarPreset}
                    aberto={painelAberto}
                    onFechar={() => setPainelAberto(false)}
                />
            )}

            {status !== 'pronto' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand-darkest/90 text-center px-6">
                    {status === 'carregando' && (
                        <div className="h-8 w-8 rounded-full border-2 border-gray-600 border-t-cyan-400 animate-spin" />
                    )}
                    <p className={`text-sm ${status === 'erro' ? 'text-red-400' : 'text-gray-400'}`}>{mensagem}</p>
                    {status === 'erro' && (
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 px-4 py-2 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
                        >
                            Tentar de novo
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ModelViewer;
