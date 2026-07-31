/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

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

/**
 * Prefixo das camadas de levantamento existente no federado: terreno natural,
 * curvas de nível, lago, pistas e drenagem já implantadas. Some tudo junto
 * porque é isso que tapa a obra nova em vista geral.
 */
const PREFIXO_EXISTENTE = 'T-';
const CHAVE_PREFERENCIA = 'elos.viewer.existenteOculto';

/**
 * Junta os nós cujo nome começa com o prefixo, sem descer neles: esconder o nó
 * pai já esconde a subárvore inteira, e percorrer 683 mil elementos um a um
 * travaria a interface.
 */
function coletarNosExistentes(viewer: any): number[] {
    const tree = viewer?.model?.getInstanceTree?.();
    if (!tree) return [];

    const encontrados: number[] = [];

    const visitar = (id: number) => {
        const nome = tree.getNodeName(id) || '';
        if (nome.startsWith(PREFIXO_EXISTENTE)) { encontrados.push(id); return; }
        tree.enumNodeChildren(id, visitar, false);
    };

    visitar(tree.getRootId());
    return encontrados;
}

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

    const idsExistenteRef = useRef<number[]>([]);
    // Na primeira visita o existente já entra escondido — foi o pedido. Depois,
    // vale a última escolha do usuário.
    const [existenteOculto, setExistenteOculto] = useState(
        () => (typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE_PREFERENCIA) !== '0' : true)
    );
    const [qtdExistente, setQtdExistente] = useState(0);

    const alternarExistente = () => {
        const viewer = viewerRef.current;
        const ids = idsExistenteRef.current;
        if (!viewer || ids.length === 0) return;

        const ocultarAgora = !existenteOculto;
        if (ocultarAgora) viewer.hide(ids); else viewer.show(ids);

        setExistenteOculto(ocultarAgora);
        try { localStorage.setItem(CHAVE_PREFERENCIA, ocultarAgora ? '1' : '0'); } catch { /* modo privado */ }
    };

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

                                const ids = coletarNosExistentes(viewer);
                                idsExistenteRef.current = ids;
                                setQtdExistente(ids.length);

                                // Lido aqui, e não capturado do estado: este efeito
                                // roda uma vez só e congelaria um valor antigo.
                                const ocultar = localStorage.getItem(CHAVE_PREFERENCIA) !== '0';
                                setExistenteOculto(ocultar);
                                if (ids.length && ocultar) viewer.hide(ids);
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

            {status === 'pronto' && qtdExistente > 0 && (
                <button
                    onClick={alternarExistente}
                    title={`${qtdExistente} camada(s) de levantamento existente: terreno, curvas de nível, lago, pistas e drenagem já implantadas`}
                    className="absolute top-3 right-3 z-10 px-3 py-2 rounded-md text-xs font-medium shadow-lg
                               bg-brand-darkest/90 border border-gray-700 text-gray-200 hover:bg-gray-800
                               backdrop-blur transition-colors"
                >
                    {existenteOculto ? 'Mostrar existente' : 'Ocultar existente'}
                    <span className="ml-2 text-gray-500">{qtdExistente}</span>
                </button>
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
