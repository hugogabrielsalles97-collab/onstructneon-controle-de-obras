import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import Sidebar from './Sidebar';
import * as pdfjsLib from 'pdfjs-dist';
import '../utils/uint8Polyfill';
import { parseEstacaRange } from '../utils/constants';
import { SERVICE_LAYERS, detectServiceIndex, laneOf, pathBetween, Calibration, EstacaPoint } from '../utils/pavimento';

pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
    new URL('../utils/pdfWorker.ts', import.meta.url),
    { type: 'module' }
);

interface PaintedSegment {
    color: string;
    layer: number;
    points: { x: number; y: number }[];
}

const VisualPavimentoPage: React.FC<any> = (props) => {
    const { currentUser: user, tasks, signOut } = useData();

    const [ready, setReady] = useState(false);
    const [aspect, setAspect] = useState(0.707);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [cal, setCal] = useState<Calibration | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Pan / zoom
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });

    // ── Carrega calibração de estacas ──
    useEffect(() => {
        fetch('/pavimento-estacas.json')
            .then(r => r.json())
            .then((data: Calibration) => { setCal(data); if (data.aspect) setAspect(data.aspect); })
            .catch(err => console.error('Erro ao carregar calibração de estacas:', err));
    }, []);

    // ── Renderiza o mapa (PDF → imagem) uma vez ──
    useEffect(() => {
        let cancelled = false;
        const render = async () => {
            try {
                setIsLoading(true);
                setLoadError(null);
                const pdf = await pdfjsLib.getDocument('/mapa-geral.pdf').promise;
                const page = await pdf.getPage(1);
                const base = page.getViewport({ scale: 1 });
                setAspect(base.height / base.width);
                const renderScale = Math.min(1.3, 3800 / base.width); // resolução equilibrada; zoom é vetorial
                const viewport = page.getViewport({ scale: renderScale });
                // Renderiza num canvas offscreen próprio (evita conflito de render duplo do StrictMode)
                const off = document.createElement('canvas');
                off.width = viewport.width;
                off.height = viewport.height;
                const offCtx = off.getContext('2d');
                if (!offCtx) return;
                await page.render({ canvasContext: offCtx, viewport, canvas: off } as any).promise;
                if (cancelled) return;
                await new Promise(r => requestAnimationFrame(() => r(null)));
                const vis = canvasRef.current;
                if (!vis) return;
                vis.width = off.width;
                vis.height = off.height;
                vis.getContext('2d')?.drawImage(off, 0, 0);
                setReady(true);
            } catch (err: any) {
                console.error('Erro ao renderizar mapa de pavimento:', err);
                if (!cancelled) setLoadError(err?.message || 'Erro ao carregar o mapa.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        render();
        return () => { cancelled = true; };
    }, []);

    // ── Pan / zoom handlers ──
    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        setIsDragging(true);
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    const handleMouseUp = () => { isDraggingRef.current = false; setIsDragging(false); };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(prev => Math.min(8, Math.max(0.2, +(prev + prev * delta).toFixed(3))));
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

    const handleLogout = useCallback(async () => {
        const { success, error } = await signOut();
        if (!success && error) props.showToast?.(`Erro ao sair: ${error}`, 'error');
    }, [signOut, props]);

    // ── Calcula os trechos pintados a partir das tarefas ──
    const segments = useMemo<PaintedSegment[]>(() => {
        if (!cal) return [];
        const laneMap: Record<'A' | 'B', EstacaPoint[]> = { A: cal.laneA, B: cal.laneB };
        const out: PaintedSegment[] = [];
        for (const t of tasks) {
            const layer = detectServiceIndex(t.title || '');
            if (layer < 0) continue;
            const range = parseEstacaRange(t.location) || parseEstacaRange((t as any).corte);
            if (!range) continue;
            const [a, b] = range;
            const lane = laneOf(a);
            if (!lane) continue;
            const progress = Math.max(0, Math.min(100, Number((t as any).progress) || 0));
            if (progress <= 0) continue;
            const paintedTo = a + (b - a) * (progress / 100);
            const pts = pathBetween(laneMap[lane], a, paintedTo);
            if (pts.length < 2) continue;
            out.push({ color: SERVICE_LAYERS[layer].color, layer, points: pts });
        }
        // Desenha camadas mais claras primeiro; as mais escuras (avançadas) sobrepõem
        out.sort((x, y) => x.layer - y.layer);
        return out;
    }, [cal, tasks]);

    const toPath = (pts: { x: number; y: number }[]) =>
        pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(4)} ${(p.y * aspect).toFixed(4)}`).join(' ');

    return (
        <div className="flex h-screen bg-brand-darkest text-gray-100 overflow-hidden">
            <Sidebar
                {...props}
                user={user}
                activeScreen="visualPavimento"
            />
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    {...props}
                    user={user}
                    onLogout={handleLogout}
                    activeScreen="visualPavimento"
                />
                <div className="flex-1 overflow-hidden p-4 lg:p-6 flex flex-col">
                    {/* Top bar */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-3 flex-shrink-0">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Visual Pavimento</h2>
                            <p className="text-xs text-brand-med-gray">Mapa de estaqueamento — avanço da pavimentação por trecho</p>
                        </div>
                        <div className="flex items-center gap-1 bg-[#111827]/60 rounded-xl px-2 py-1.5 border border-white/10">
                            <button onClick={() => setScale(p => Math.max(0.2, p - 0.15))} className="text-white/70 hover:text-white p-1">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            </button>
                            <span className="text-[10px] font-bold text-white/80 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                            <button onClick={() => setScale(p => Math.min(8, p + 0.15))} className="text-white/70 hover:text-white p-1">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            </button>
                            <button onClick={handleReset} className="text-[9px] font-bold text-brand-med-gray hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10">Reset</button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 mb-3 flex-shrink-0 flex-wrap">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Serviços:</span>
                        {SERVICE_LAYERS.map(s => (
                            <div key={s.key} className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm border border-white/20" style={{ backgroundColor: s.color }}></div>
                                <span className="text-[10px] font-bold text-gray-300">{s.label}</span>
                            </div>
                        ))}
                        <span className="text-[9px] text-gray-600 ml-2 italic">claro → escuro conforme avança a camada</span>
                    </div>

                    {/* Viewer */}
                    <div
                        ref={containerRef}
                        className="flex-1 min-h-0 overflow-hidden bg-[#0a0f1a] rounded-2xl border border-white/5 shadow-inner relative select-none"
                        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                                <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-xs text-brand-med-gray">Renderizando mapa em alta definição…</p>
                            </div>
                        )}
                        {loadError && !isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <p className="text-sm font-bold text-red-400">Erro ao carregar o mapa</p>
                                <p className="text-xs text-brand-med-gray">{loadError}</p>
                            </div>
                        )}
                        <div
                            className="absolute top-1/2 left-1/2"
                            style={{
                                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transformOrigin: 'center center',
                                transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                                width: '94%',
                                visibility: ready ? 'visible' : 'hidden',
                            }}
                        >
                            <div className="relative w-full">
                                <canvas
                                    ref={canvasRef}
                                    className="w-full block pointer-events-none"
                                    style={{ filter: 'grayscale(1) contrast(1.05) brightness(1.06)' }}
                                />
                                <svg
                                    viewBox={`0 0 1 ${aspect}`}
                                    preserveAspectRatio="none"
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                >
                                    {segments.map((seg, i) => (
                                        <path
                                            key={i}
                                            d={toPath(seg.points)}
                                            fill="none"
                                            stroke={seg.color}
                                            strokeWidth={0.009}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            opacity={0.92}
                                        />
                                    ))}
                                </svg>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-2 text-center flex-shrink-0">
                        🖱️ Arrastar = mover · Roleta = zoom · pintura proporcional ao % de avanço da tarefa
                    </p>
                </div>
            </main>
        </div>
    );
};

export default VisualPavimentoPage;
