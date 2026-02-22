
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/DataProvider';
import { supabase } from '../supabaseClient';
import Header from './Header';
import Sidebar from './Sidebar';
import { Task, Resource } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite ?url import
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─── OAE DATA ───────────────────────────────────────────────────
interface OAEConfig {
    id: string;
    label: string;
    engineer: string;
    // Position as percentage of PDF image dimensions (0-100)
    x: number;
    y: number;
}

const OAE_LIST: OAEConfig[] = [
    // Sentido S (lado esquerdo → direito, de cima pra baixo)
    { id: 'OAE S01', label: 'S01', engineer: 'Bruno Bastos', x: 5, y: 30 },
    { id: 'OAE S02', label: 'S02', engineer: 'Bruno Bastos', x: 10, y: 30 },
    { id: 'OAE S03', label: 'S03', engineer: 'Bruno Bastos', x: 15, y: 30 },
    { id: 'OAE S04', label: 'S04', engineer: 'Bruno Bastos', x: 20, y: 30 },
    { id: 'OAE S05', label: 'S05', engineer: 'Bruno Bastos', x: 25, y: 30 },
    { id: 'OAE S06', label: 'S06', engineer: 'Bruno Bastos', x: 30, y: 30 },
    { id: 'OAE S07', label: 'S07', engineer: 'Bruno Bastos', x: 35, y: 30 },
    { id: 'OAE S08', label: 'S08', engineer: 'Bruno Bastos', x: 40, y: 30 },
    { id: 'OAE S09', label: 'S09', engineer: 'Bruno Bastos', x: 45, y: 30 },
    { id: 'OAE S10', label: 'S10', engineer: 'Matheus Ramos', x: 50, y: 30 },
    { id: 'OAE S11', label: 'S11', engineer: 'Matheus Ramos', x: 55, y: 30 },
    { id: 'OAE S12', label: 'S12', engineer: 'Matheus Ramos', x: 60, y: 30 },
    { id: 'OAE S13', label: 'S13', engineer: 'Rafael Requiao', x: 65, y: 30 },
    { id: 'OAE S14', label: 'S14', engineer: 'Rafael Requiao', x: 70, y: 30 },
    // Sentido D (lado esquerdo → direito, abaixo)
    { id: 'OAE D15', label: 'D15', engineer: 'Bruno Bastos', x: 5, y: 65 },
    { id: 'OAE D16', label: 'D16', engineer: 'Bruno Bastos', x: 10, y: 65 },
    { id: 'OAE D17', label: 'D17', engineer: 'Bruno Bastos', x: 15, y: 65 },
    { id: 'OAE D18', label: 'D18', engineer: 'Bruno Bastos', x: 20, y: 65 },
    { id: 'OAE D19', label: 'D19', engineer: 'Matheus Ramos', x: 25, y: 65 },
    { id: 'OAE D20', label: 'D20', engineer: 'Matheus Ramos', x: 30, y: 65 },
    { id: 'OAE D21', label: 'D21', engineer: 'Matheus Ramos', x: 35, y: 65 },
    { id: 'OAE D22', label: 'D22', engineer: 'Rafael Requiao', x: 40, y: 65 },
    { id: 'OAE D23', label: 'D23', engineer: 'Rafael Requiao', x: 45, y: 65 },
    { id: 'OAE D24', label: 'D24', engineer: 'Rafael Requiao', x: 50, y: 65 },
    { id: 'Quadratum', label: 'Quadratum', engineer: 'Bruno Bastos', x: 75, y: 45 },
    { id: 'Pátio de vigas', label: 'Pátio de vigas', engineer: 'Matheus Ramos', x: 75, y: 55 },
];

// Color per engineer
const ENGINEER_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    'Bruno Bastos': { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.6)', text: '#93c5fd', dot: '#3b82f6' },
    'Matheus Ramos': { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.6)', text: '#6ee7b7', dot: '#10b981' },
    'Rafael Requiao': { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.6)', text: '#fcd34d', dot: '#f59e0b' },
};

// ─── COMPONENT ──────────────────────────────────────────────────
interface VisualControlPageProps {
    onNavigateToHome: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToCost: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToCheckoutSummary: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const VisualControlPage: React.FC<VisualControlPageProps> = (props) => {
    const { currentUser: user, signOut, tasks } = useData();

    // PDF rendering state
    const [pdfPages, setPdfPages] = useState<string[]>([]);
    const [isLoadingPdf, setIsLoadingPdf] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);

    // Date filter
    const [filterDate, setFilterDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    // Zoom & drag state — translate-based (no scroll limits)
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // Selected OAE for detail popup
    const [selectedOAE, setSelectedOAE] = useState<string | null>(null);

    // Edit mode for positioning OAEs
    const [editMode, setEditMode] = useState(false);

    // Default positions as fallbacks
    const defaultOaePositions = useMemo(() => {
        const d: Record<string, { x: number; y: number }> = {};
        OAE_LIST.forEach(oae => { d[oae.id] = { x: oae.x, y: oae.y }; });
        return d;
    }, []);
    const defaultCardPositions = useMemo(() => {
        const d: Record<string, { x: number; y: number }> = {};
        OAE_LIST.forEach(oae => { d[oae.id] = { x: oae.x + 3, y: oae.y - 2 }; });
        return d;
    }, []);

    const [oaePositions, setOaePositions] = useState<Record<string, { x: number; y: number }>>(() => {
        // Use localStorage as immediate fallback while Supabase loads
        const saved = localStorage.getItem('oae_positions');
        if (saved) { try { return JSON.parse(saved); } catch { } }
        const defaults: Record<string, { x: number; y: number }> = {};
        OAE_LIST.forEach(oae => { defaults[oae.id] = { x: oae.x, y: oae.y }; });
        return defaults;
    });

    const [cardPositions, setCardPositions] = useState<Record<string, { x: number; y: number }>>(() => {
        const saved = localStorage.getItem('oae_card_positions');
        if (saved) { try { return JSON.parse(saved); } catch { } }
        const defaults: Record<string, { x: number; y: number }> = {};
        OAE_LIST.forEach(oae => { defaults[oae.id] = { x: oae.x + 3, y: oae.y - 2 }; });
        return defaults;
    });

    const [draggingOAE, setDraggingOAE] = useState<string | null>(null);
    const [draggingCard, setDraggingCard] = useState<string | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // ─── Load positions from Supabase on mount ─────────────────
    useEffect(() => {
        const loadPositions = async () => {
            const { data, error } = await supabase
                .from('oae_positions')
                .select('oae_id, marker_x, marker_y, card_x, card_y');

            if (error || !data || data.length === 0) return;

            const markers: Record<string, { x: number; y: number }> = {};
            const cards: Record<string, { x: number; y: number }> = {};

            data.forEach((row: any) => {
                markers[row.oae_id] = { x: Number(row.marker_x), y: Number(row.marker_y) };
                cards[row.oae_id] = { x: Number(row.card_x), y: Number(row.card_y) };
            });

            // Merge with defaults for any OAEs not yet saved in DB
            const fullMarkers = { ...defaultOaePositions, ...markers };
            const fullCards = { ...defaultCardPositions, ...cards };

            setOaePositions(fullMarkers);
            setCardPositions(fullCards);

            // Sync localStorage
            localStorage.setItem('oae_positions', JSON.stringify(fullMarkers));
            localStorage.setItem('oae_card_positions', JSON.stringify(fullCards));
        };
        loadPositions();
    }, [defaultOaePositions, defaultCardPositions]);

    // ─── Save positions to Supabase ────────────────────────────
    const savePositionsToSupabase = useCallback(async (
        markerPositions: Record<string, { x: number; y: number }>,
        cardPos: Record<string, { x: number; y: number }>,
        changedOaeId?: string
    ) => {
        // Save to localStorage immediately
        localStorage.setItem('oae_positions', JSON.stringify(markerPositions));
        localStorage.setItem('oae_card_positions', JSON.stringify(cardPos));

        // Build rows to upsert (only changed, or all if not specified)
        const oaeIds = changedOaeId ? [changedOaeId] : OAE_LIST.map(o => o.id);
        const rows = oaeIds.map(id => ({
            oae_id: id,
            marker_x: markerPositions[id]?.x ?? defaultOaePositions[id]?.x ?? 50,
            marker_y: markerPositions[id]?.y ?? defaultOaePositions[id]?.y ?? 50,
            card_x: cardPos[id]?.x ?? defaultCardPositions[id]?.x ?? 55,
            card_y: cardPos[id]?.y ?? defaultCardPositions[id]?.y ?? 50,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null
        }));

        const { error } = await supabase
            .from('oae_positions')
            .upsert(rows, { onConflict: 'oae_id' });

        if (error) {
            console.error('Erro ao salvar posições no Supabase:', error);
        }
    }, [user, defaultOaePositions, defaultCardPositions]);


    const handleLogout = async () => {
        await signOut();
    };

    // ─── PDF Loading ────────────────────────────────────────────
    useEffect(() => {
        const loadPdf = async () => {
            try {
                setIsLoadingPdf(true);
                setLoadError(null);
                const loadingTask = pdfjsLib.getDocument('/mapa-frentes.pdf');
                const pdf = await loadingTask.promise;
                const pages: string[] = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 3 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) continue;
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({
                        canvasContext: ctx,
                        viewport: viewport,
                        canvas: canvas,
                    } as any).promise;
                    pages.push(canvas.toDataURL('image/png'));
                }
                setPdfPages(pages);
            } catch (err: any) {
                console.error('Erro ao carregar PDF:', err);
                setLoadError(err.message || 'Erro desconhecido ao carregar o PDF.');
            } finally {
                setIsLoadingPdf(false);
            }
        };
        loadPdf();
    }, []);

    // ─── Filter tasks by date and match to OAEs ────────────────
    type OAETaskEntry = {
        tasks: Task[];
        totalWorkers: number;
        workersByRole: Record<string, number>;
        assignees: Set<string>;
    };
    const oaeTaskData = useMemo(() => {
        const result: Record<string, OAETaskEntry> = {};

        OAE_LIST.forEach(oae => {
            result[oae.id] = { tasks: [], totalWorkers: 0, workersByRole: {}, assignees: new Set() };
        });

        // Filter tasks active on the selected date
        tasks.forEach(task => {
            if (!task.location) return;

            const taskStart = new Date(task.startDate + 'T00:00:00');
            const taskEnd = new Date(task.dueDate + 'T23:59:59');
            const selected = new Date(filterDate + 'T12:00:00');

            if (selected < taskStart || selected > taskEnd) return;

            // Match task location to OAE
            const loc = task.location.toUpperCase().trim();
            const matchingOAE = OAE_LIST.find(oae =>
                loc.includes(oae.id.toUpperCase()) ||
                loc.includes(oae.label) ||
                loc === oae.id.toUpperCase()
            );

            if (matchingOAE && result[matchingOAE.id]) {
                const entry = result[matchingOAE.id];
                entry.tasks.push(task);
                if (task.assignee) entry.assignees.add(task.assignee);

                // Accumulate manpower
                (task.plannedManpower || []).forEach((mp: Resource) => {
                    if (mp.role && mp.quantity) {
                        entry.workersByRole[mp.role] = (entry.workersByRole[mp.role] || 0) + mp.quantity;
                        entry.totalWorkers += mp.quantity;
                    }
                });
            }
        });

        return result;
    }, [tasks, filterDate]);

    // ─── Mouse drag handlers ────────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
        if (editMode) return; // Don't pan in edit mode
        isDraggingRef.current = true;
        setIsDragging(true);
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (editMode && draggingOAE && imageRef.current) {
            // Move OAE marker in edit mode
            e.preventDefault();
            const rect = imageRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setOaePositions(prev => ({
                ...prev,
                [draggingOAE]: { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
            }));
            return;
        }
        if (editMode && draggingCard && imageRef.current) {
            // Move card in edit mode
            e.preventDefault();
            const rect = imageRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setCardPositions(prev => ({
                ...prev,
                [draggingCard]: { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
            }));
            return;
        }
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        if (draggingOAE) {
            const movedId = draggingOAE;
            setDraggingOAE(null);
            savePositionsToSupabase(oaePositions, cardPositions, movedId);
        }
        if (draggingCard) {
            const movedId = draggingCard;
            setDraggingCard(null);
            savePositionsToSupabase(oaePositions, cardPositions, movedId);
        }
    };

    // Wheel zoom handler
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            setScale(prev => Math.min(5, Math.max(0.1, prev + delta)));
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    const handleResetView = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // ─── PRINT FUNCTION ──────────────────────────────────────────
    const handlePrint = () => {
        if (!pdfPages.length) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) { props.showToast('Popup bloqueado! Permita popups para imprimir.', 'error'); return; }

        // Build compact OAE labels for the map (no big cards)
        let overlaysHTML = '';

        OAE_LIST.forEach(oae => {
            const pos = getOAEPosition(oae.id);
            const data = oaeTaskData[oae.id];
            const hasActivity = data && data.tasks.length > 0;
            const colors = ENGINEER_COLORS[oae.engineer] || ENGINEER_COLORS['Bruno Bastos'];

            // Compact label on map: colored circle + small tag
            overlaysHTML += `
                <div style="
                    position: absolute;
                    left: ${pos.x}%;
                    top: ${pos.y}%;
                    transform: translate(-50%, -50%);
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    z-index: 20;
                    pointer-events: none;
                ">
                    <div style="
                        width: ${hasActivity ? '28px' : '18px'};
                        height: ${hasActivity ? '28px' : '18px'};
                        border-radius: 50%;
                        background: ${hasActivity ? colors.dot : '#ccc'};
                        border: 2px solid ${hasActivity ? '#fff' : '#999'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
                        flex-shrink: 0;
                    ">
                        <span style="font-size:${hasActivity ? '8px' : '6px'}; font-weight:900; color:white;">${oae.label}</span>
                    </div>
                    ${hasActivity ? `<div style="
                        background: white;
                        border: 1.5px solid ${colors.dot};
                        border-radius: 4px;
                        padding: 1px 4px;
                        font-size: 7px;
                        font-weight: 900;
                        color: ${colors.dot};
                        white-space: nowrap;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    ">${data.totalWorkers} trab.</div>` : ''}
                </div>
            `;
        });

        // Build detail table rows for active OAEs
        let tableRowsHTML = '';
        OAE_LIST.forEach(oae => {
            const data = oaeTaskData[oae.id];
            if (!data || data.tasks.length === 0) return;
            const colors = ENGINEER_COLORS[oae.engineer] || ENGINEER_COLORS['Bruno Bastos'];

            const tasksList = data.tasks.map((t: any) => t.title).join('; ');
            const workersList = Object.entries(data.workersByRole).map(([role, qty]) => `${qty}× ${role}`).join(', ');
            const assigneesList = Array.from(data.assignees).join(', ');

            tableRowsHTML += `
                <tr>
                    <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-weight:900; white-space:nowrap;">
                        <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${colors.dot}; vertical-align:middle; margin-right:6px;"></span>
                        ${oae.id}
                    </td>
                    <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:11px; color:#555;">${oae.engineer}</td>
                    <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:11px;">${data.tasks.map(t => `${t.support ? `[${t.support}] ` : ''}${t.title}`).join('; ')}</td>
                    <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:11px; white-space:nowrap;">${workersList || '—'}</td>
                    <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:11px; font-weight:800; text-align:center; color:${colors.dot};">${data.totalWorkers}</td>
                    <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:10px; color:#888;">${assigneesList || '—'}</td>
                </tr>
            `;
        });

        // Engineer legend
        const legendHtml = Object.entries(ENGINEER_COLORS).map(([name, c]) =>
            `<div style="display:flex; align-items:center; gap:6px; margin-right:20px;"><div style="width:12px; height:12px; border-radius:50%; background:${c.dot};"></div><span style="font-size:11px; font-weight:700; color:#333;">${name}</span></div>`
        ).join('');

        const dateFormatted = new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Controle Visual — ${dateFormatted}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Inter', sans-serif; background: white; padding: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th { text-align: left; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none !important; }
                        @page { size: landscape; margin: 8mm; }
                    }
                </style>
            </head>
            <body>
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; padding-bottom:10px; border-bottom:3px solid #111;">
                    <div>
                        <h1 style="font-size:20px; font-weight:900; color:#111; letter-spacing:1px;">🗺️ CONTROLE VISUAL DE FRENTES</h1>
                        <p style="font-size:11px; color:#666; font-weight:600; margin-top:3px;">📅 ${dateFormatted}</p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div style="background:#eff6ff; border:1.5px solid #3b82f6; border-radius:8px; padding:6px 14px; text-align:center;">
                            <div style="font-size:18px; font-weight:900; color:#3b82f6;">${activeOAECount}</div>
                            <div style="font-size:8px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:1px;">OAEs Ativas</div>
                        </div>
                        <div style="background:#fff7ed; border:1.5px solid #f59e0b; border-radius:8px; padding:6px 14px; text-align:center;">
                            <div style="font-size:18px; font-weight:900; color:#f59e0b;">${totalWorkersOnDate}</div>
                            <div style="font-size:8px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Trabalhadores</div>
                        </div>
                    </div>
                </div>

                <!-- Legend -->
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                    <span style="font-size:9px; font-weight:900; color:#888; text-transform:uppercase; letter-spacing:2px; margin-right:12px;">Engenheiros:</span>
                    ${legendHtml}
                </div>

                <!-- Map Container (compact labels only) -->
                <div style="position:relative; display:inline-block; width:100%; border:1.5px solid #ddd; border-radius:8px; overflow:hidden;">
                    <img src="${pdfPages[currentPage]}" style="width:100%; display:block;" />
                    ${overlaysHTML}
                </div>

                <!-- Detail Table -->
                <div style="margin-top:16px;">
                    <h2 style="font-size:14px; font-weight:900; color:#111; margin-bottom:8px; letter-spacing:1px; text-transform:uppercase; border-bottom:2px solid #111; padding-bottom:6px;">
                        📋 Detalhamento por OAE
                    </h2>
                    <table>
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="padding:6px 10px; font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #e2e8f0;">OAE</th>
                                <th style="padding:6px 10px; font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #e2e8f0;">Engenheiro</th>
                                <th style="padding:6px 10px; font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #e2e8f0;">Atividades</th>
                                <th style="padding:6px 10px; font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #e2e8f0;">Efetivo</th>
                                <th style="padding:6px 10px; font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #e2e8f0; text-align:center;">Total</th>
                                <th style="padding:6px 10px; font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #e2e8f0;">Responsáveis</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHTML}
                        </tbody>
                    </table>
                </div>

                <!-- Print button -->
                <div class="no-print" style="text-align:center; margin-top:20px;">
                    <button onclick="window.print()" style="
                        font-size:16px; font-weight:800; color:white;
                        background:linear-gradient(135deg, #3b82f6, #6366f1);
                        border:none; border-radius:12px;
                        padding:14px 40px; cursor:pointer;
                        box-shadow:0 4px 16px rgba(59,130,246,0.3);
                    ">🖨️ Imprimir</button>
                </div>

                <!-- Footer -->
                <div style="margin-top:12px; padding-top:6px; border-top:1px solid #eee; display:flex; justify-content:space-between; font-size:9px; color:#aaa;">
                    <span>ConstructNeon — Controle de Obras</span>
                    <span>Gerado em: ${new Date().toLocaleString('pt-BR')}</span>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
    };


    const getOAEPosition = (oaeId: string) => {
        return oaePositions[oaeId] || { x: 50, y: 50 };
    };

    const getCardPosition = (oaeId: string) => {
        return cardPositions[oaeId] || { x: (oaePositions[oaeId]?.x || 50) + 3, y: (oaePositions[oaeId]?.y || 50) - 2 };
    };

    // Count active OAEs
    const activeOAECount = useMemo(() => {
        return (Object.values(oaeTaskData) as OAETaskEntry[]).filter(d => d.tasks.length > 0).length;
    }, [oaeTaskData]);

    const totalWorkersOnDate = useMemo(() => {
        return (Object.values(oaeTaskData) as OAETaskEntry[]).reduce((sum, d) => sum + d.totalWorkers, 0);
    }, [oaeTaskData]);

    if (!user) return null;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="visualControl"
                onNavigateToHome={props.onNavigateToHome}
                onNavigateToDashboard={props.onNavigateToDashboard}
                onNavigateToReports={props.onNavigateToReports}
                onNavigateToBaseline={props.onNavigateToBaseline}
                onNavigateToCurrentSchedule={props.onNavigateToCurrentSchedule}
                onNavigateToAnalysis={props.onNavigateToAnalysis}
                onNavigateToLean={props.onNavigateToLean}
                onNavigateToLeanConstruction={props.onNavigateToLeanConstruction}
                onNavigateToWarRoom={props.onNavigateToWarRoom}
                onNavigateToPodcast={props.onNavigateToPodcast}
                onNavigateToCheckoutSummary={props.onNavigateToCheckoutSummary}
                onNavigateToOrgChart={props.onNavigateToOrgChart}
                onNavigateToVisualControl={props.onNavigateToVisualControl}
                onUpgradeClick={props.onUpgradeClick}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    user={user}
                    onLogout={handleLogout}
                    onNavigateToHome={props.onNavigateToHome}
                    onNavigateToDashboard={props.onNavigateToDashboard}
                    onNavigateToReports={props.onNavigateToReports}
                    onNavigateToBaseline={props.onNavigateToBaseline}
                    onNavigateToCurrentSchedule={props.onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={props.onNavigateToAnalysis}
                    onNavigateToLean={props.onNavigateToLean}
                    onNavigateToLeanConstruction={props.onNavigateToLeanConstruction}
                    onNavigateToWarRoom={props.onNavigateToWarRoom}
                    onNavigateToPodcast={props.onNavigateToPodcast}
                    onNavigateToCost={props.onNavigateToCost}
                    onNavigateToCheckoutSummary={props.onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={props.onNavigateToOrgChart}
                    onUpgradeClick={props.onUpgradeClick}
                    activeScreen="visualControl"
                />

                <div className="flex-1 overflow-hidden p-4 lg:p-6 flex flex-col">
                    <div className="w-full flex flex-col flex-1 min-h-0">
                        {/* ── Top Bar: Title + Filters + Controls ── */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-4 flex-shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Controle Visual</h2>
                                <p className="text-xs text-brand-med-gray">Mapa de Frentes de Serviço — Atividades integradas à Programação Semanal</p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Date filter */}
                                <div className="flex items-center gap-2 bg-[#111827]/80 rounded-xl px-3 py-2 border border-white/10">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-accent">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className="bg-transparent text-white text-xs font-bold border-none outline-none cursor-pointer"
                                    />
                                </div>

                                {/* Stats badges */}
                                <div className="flex items-center gap-2">
                                    <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg">
                                        {activeOAECount} OAEs Ativas
                                    </span>
                                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg">
                                        {totalWorkersOnDate} Trabalhadores
                                    </span>
                                </div>

                                {/* Edit mode toggle */}
                                <button
                                    onClick={() => setEditMode(!editMode)}
                                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${editMode
                                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                        : 'bg-white/5 border-white/10 text-brand-med-gray hover:text-white hover:border-white/20'
                                        }`}
                                    title="Ativar modo de posicionamento das OAEs"
                                >
                                    {editMode ? '✕ Sair Edição' : '⚙ Posicionar OAEs'}
                                </button>

                                {/* Print button */}
                                <button
                                    onClick={handlePrint}
                                    className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all bg-white/5 border-white/10 text-brand-med-gray hover:text-white hover:border-white/20 hover:bg-blue-500/10"
                                    title="Imprimir mapa com overlays"
                                >
                                    🖨️ Imprimir
                                </button>

                                {/* Zoom controls */}
                                <div className="flex items-center gap-1 bg-[#111827]/60 rounded-xl px-2 py-1.5 border border-white/10">
                                    <button onClick={() => setScale(prev => Math.max(0.1, prev - 0.1))} className="text-white/70 hover:text-white transition-colors p-1">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    </button>
                                    <span className="text-[10px] font-bold text-white/80 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                                    <button onClick={() => setScale(prev => Math.min(5, prev + 0.1))} className="text-white/70 hover:text-white transition-colors p-1">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    </button>
                                    <button onClick={handleResetView} className="text-[9px] font-bold text-brand-med-gray hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/10">
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Engineer Legend ── */}
                        <div className="flex items-center gap-4 mb-3 flex-shrink-0">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Engenheiros:</span>
                            {Object.entries(ENGINEER_COLORS).map(([name, colors]) => (
                                <div key={name} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.dot }}></div>
                                    <span className="text-[10px] font-bold" style={{ color: colors.text }}>{name}</span>
                                </div>
                            ))}
                        </div>

                        {/* ── PDF Viewer with OAE Overlays ── */}
                        <div
                            ref={containerRef}
                            className="flex-1 min-h-0 overflow-hidden bg-[#0a0f1a] rounded-2xl border border-white/5 shadow-inner relative select-none"
                            style={{ cursor: editMode ? 'default' : isDragging ? 'grabbing' : 'grab' }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            {isLoadingPdf && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-brand-accent/20 blur-2xl rounded-full animate-pulse"></div>
                                        <div className="relative bg-[#111827]/80 p-5 rounded-2xl border border-brand-accent/20 backdrop-blur-xl">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-accent animate-spin">
                                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                            </svg>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-white">Carregando Mapa de Frentes...</p>
                                    <p className="text-xs text-brand-med-gray">Renderizando PDF em alta definição</p>
                                </div>
                            )}

                            {loadError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                                    <div className="bg-red-500/10 p-5 rounded-2xl border border-red-500/20">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                                            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-bold text-red-400">Erro ao carregar o PDF</p>
                                    <p className="text-xs text-brand-med-gray mt-1 max-w-sm">{loadError}</p>
                                </div>
                            )}

                            {!isLoadingPdf && !loadError && pdfPages.length > 0 && (
                                <div
                                    style={{
                                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                        transformOrigin: 'center center',
                                        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                    }}
                                >
                                    {/* PDF Image */}
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                        <img
                                            ref={imageRef}
                                            src={pdfPages[currentPage]}
                                            alt="Mapa de Frentes"
                                            className="max-w-none rounded-lg shadow-2xl"
                                            draggable={false}
                                            style={{ pointerEvents: 'none', maxHeight: '100%', objectFit: 'contain' }}
                                        />

                                        {/* ── OAE Overlay Markers ── */}
                                        {OAE_LIST.map(oae => {
                                            const pos = getOAEPosition(oae.id);
                                            const cardPos = getCardPosition(oae.id);
                                            const data = oaeTaskData[oae.id];
                                            const hasActivity = data && data.tasks.length > 0;
                                            const colors = ENGINEER_COLORS[oae.engineer] || ENGINEER_COLORS['Bruno Bastos'];
                                            const isSelected = selectedOAE === oae.id;

                                            return (
                                                <React.Fragment key={oae.id}>
                                                    {/* Connecting line from marker to card */}
                                                    {hasActivity && (
                                                        <svg
                                                            style={{
                                                                position: 'absolute',
                                                                left: 0,
                                                                top: 0,
                                                                width: '100%',
                                                                height: '100%',
                                                                pointerEvents: 'none',
                                                                zIndex: 5,
                                                                overflow: 'visible',
                                                            }}
                                                        >
                                                            <line
                                                                x1={`${pos.x}%`}
                                                                y1={`${pos.y}%`}
                                                                x2={`${cardPos.x}%`}
                                                                y2={`${cardPos.y}%`}
                                                                stroke="#000000"
                                                                strokeWidth="2"
                                                                strokeDasharray="6 4"
                                                                opacity="1"
                                                            />
                                                        </svg>
                                                    )}

                                                    {/* OAE Circle Marker */}
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${pos.x}%`,
                                                            top: `${pos.y}%`,
                                                            transform: 'translate(-50%, -50%)',
                                                            zIndex: isSelected ? 50 : hasActivity ? 20 : 10,
                                                            pointerEvents: 'auto',
                                                        }}
                                                    >
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (editMode) return;
                                                                setSelectedOAE(isSelected ? null : oae.id);
                                                            }}
                                                            onMouseDown={(e) => {
                                                                if (editMode) {
                                                                    e.stopPropagation();
                                                                    setDraggingOAE(oae.id);
                                                                }
                                                            }}
                                                            style={{
                                                                width: hasActivity ? '32px' : '22px',
                                                                height: hasActivity ? '32px' : '22px',
                                                                borderRadius: '50%',
                                                                backgroundColor: hasActivity ? colors.bg : 'rgba(100,100,100,0.2)',
                                                                border: `2px ${hasActivity ? 'solid' : 'dashed'} ${hasActivity ? colors.border : 'rgba(100,100,100,0.4)'}`,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                cursor: editMode ? 'move' : 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: hasActivity ? `0 0 12px ${colors.border}` : 'none',
                                                            }}
                                                            className={hasActivity ? 'animate-pulse' : ''}
                                                            title={`${oae.id} — ${oae.engineer}`}
                                                        >
                                                            <span style={{
                                                                fontSize: hasActivity ? '8px' : '6px',
                                                                fontWeight: 900,
                                                                color: hasActivity ? colors.text : 'rgba(150,150,150,0.6)',
                                                                letterSpacing: '0.5px',
                                                            }}>
                                                                {oae.label}
                                                            </span>
                                                        </div>

                                                        {/* Worker count badge */}
                                                        {hasActivity && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '-8px',
                                                                    right: '-8px',
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: colors.dot,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '8px',
                                                                    fontWeight: 900,
                                                                    color: 'white',
                                                                    boxShadow: `0 0 8px ${colors.dot}`,
                                                                }}
                                                            >
                                                                {data.totalWorkers}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* ── Always-visible Detail Card (draggable in edit mode) ── */}
                                                    {hasActivity && (
                                                        <div
                                                            onClick={(e) => e.stopPropagation()}
                                                            onMouseDown={(e) => {
                                                                if (editMode) {
                                                                    e.stopPropagation();
                                                                    setDraggingCard(oae.id);
                                                                }
                                                            }}
                                                            style={{
                                                                position: 'absolute',
                                                                left: `${cardPos.x}%`,
                                                                top: `${cardPos.y}%`,
                                                                transform: 'translate(-50%, -50%)',
                                                                minWidth: '200px',
                                                                maxWidth: '260px',
                                                                backgroundColor: 'rgba(13, 21, 37, 0.92)',
                                                                backdropFilter: 'blur(16px)',
                                                                border: `1px solid ${colors.border}`,
                                                                borderRadius: '10px',
                                                                padding: '10px',
                                                                boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${colors.bg}`,
                                                                zIndex: isSelected ? 90 : 30,
                                                                cursor: editMode ? 'move' : 'default',
                                                                pointerEvents: 'auto',
                                                                transition: draggingCard === oae.id ? 'none' : 'box-shadow 0.2s ease',
                                                            }}
                                                        >
                                                            {/* Edit mode grip indicator */}
                                                            {editMode && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: '3px',
                                                                    right: '6px',
                                                                    fontSize: '10px',
                                                                    color: 'rgba(150,150,150,0.4)',
                                                                    cursor: 'move',
                                                                }}>⋮⋮</div>
                                                            )}

                                                            {/* Header */}
                                                            <div style={{ marginBottom: '6px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '6px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{
                                                                        fontSize: '11px', fontWeight: 900, color: colors.text, letterSpacing: '1px',
                                                                    }}>
                                                                        {oae.id}
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: '8px', fontWeight: 700, color: 'rgba(150,150,150,0.6)',
                                                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '4px',
                                                                    }}>
                                                                        {data.totalWorkers} trab.
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: '8px', color: 'rgba(150,150,150,0.7)', fontWeight: 700, marginTop: '2px' }}>
                                                                    🔧 {oae.engineer}
                                                                </div>
                                                            </div>

                                                            {/* Activities (compact) */}
                                                            <div style={{ marginBottom: '6px' }}>
                                                                {data.tasks.slice(0, 3).map((task, i) => (
                                                                    <div key={task.id || i} style={{
                                                                        fontSize: '8px', color: 'rgba(220,220,220,0.85)', padding: '2px 0',
                                                                        borderBottom: i < Math.min(data.tasks.length, 3) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                                    }}>
                                                                        <div style={{ fontWeight: 700 }}>
                                                                            {task.support && (
                                                                                <span style={{ color: 'rgba(255,165,0,0.9)', marginRight: '4px' }}>[{task.support}]</span>
                                                                            )}
                                                                            • {task.title}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {data.tasks.length > 3 && (
                                                                    <div style={{ fontSize: '7px', color: 'rgba(150,150,150,0.5)', fontStyle: 'italic', marginTop: '2px' }}>
                                                                        +{data.tasks.length - 3} mais...
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Workers by role */}
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                                                {Object.entries(data.workersByRole).map(([role, qty]) => (
                                                                    <div key={role} style={{
                                                                        fontSize: '7px',
                                                                        fontWeight: 800,
                                                                        color: colors.text,
                                                                        backgroundColor: colors.bg,
                                                                        border: `1px solid ${colors.border}`,
                                                                        borderRadius: '4px',
                                                                        padding: '1px 4px',
                                                                    }}>
                                                                        {qty}× {role}
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Responsáveis */}
                                                            {data.assignees.size > 0 && (
                                                                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                                    <div style={{ fontSize: '7px', color: 'rgba(220,220,220,0.7)', fontWeight: 600 }}>
                                                                        👷 {Array.from(data.assignees).join(', ')}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Inactive OAE tooltip on click */}
                                                    {isSelected && !hasActivity && (
                                                        <div
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                position: 'absolute',
                                                                left: `${pos.x + 2}%`,
                                                                top: `${pos.y}%`,
                                                                transform: 'translate(0, -50%)',
                                                                minWidth: '140px',
                                                                backgroundColor: 'rgba(13, 21, 37, 0.95)',
                                                                backdropFilter: 'blur(16px)',
                                                                border: '1px solid rgba(100,100,100,0.3)',
                                                                borderRadius: '8px',
                                                                padding: '8px',
                                                                zIndex: 100,
                                                                pointerEvents: 'auto',
                                                            }}
                                                        >
                                                            <div style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(200,200,200,0.8)' }}>{oae.id}</div>
                                                            <div style={{ fontSize: '8px', color: 'rgba(150,150,150,0.6)', marginTop: '2px' }}>
                                                                🔧 {oae.engineer}
                                                            </div>
                                                            <div style={{ fontSize: '8px', color: 'rgba(150,150,150,0.4)', marginTop: '4px', fontStyle: 'italic' }}>
                                                                Sem atividades nesta data
                                                            </div>
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* ── Bottom hints ── */}
                        <div className="flex items-center justify-center gap-6 mt-2 flex-shrink-0">
                            <div className="flex items-center gap-2 text-[9px] text-brand-med-gray/50">
                                <span>🖱️ Roleta = Zoom</span>
                                <span>•</span>
                                <span>✋ Arrastar = Mover</span>
                                <span>•</span>
                                <span>👆 Clique na OAE = Detalhes</span>
                                {editMode && (
                                    <>
                                        <span>•</span>
                                        <span className="text-red-400 font-bold">⚡ Arraste marcadores e caixas para reposicionar</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default VisualControlPage;
