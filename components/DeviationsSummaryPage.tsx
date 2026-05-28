import React, { useState, useMemo, useEffect } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    TrendingDown,
    TrendingUp,
    Activity,
    Gauge,
    Building2,
    User,
    Target,
    LayoutDashboard,
    ListChecks,
    ChevronRight,
    X,
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    LabelList,
} from 'recharts';
import Sidebar from './Sidebar';
import { useTheme } from '../utils/theme';
import { useData } from '../context/DataProvider';
import { MonitoringRow } from '../types';
import { supabase } from '../supabaseClient';

interface DeviationsSummaryPageProps {
    onNavigateToHome: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToMonitoringControl: () => void;
    onNavigateToMonitoringDashboard: () => void;
    onNavigateToMonitoringDeviations: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToCost: () => void;
    onNavigateToCheckoutSummary: () => void;
    onNavigateToOrgChart: () => void;
    onNavigateToOrgSummary: () => void;
    onNavigateToTeams: () => void;
    onNavigateToVisualControl: () => void;
    onNavigateToSystem: () => void;
    onUpgradeClick: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
}

const STORAGE_KEY = '@elos_monitoring_data_v2';

const SERVICE_ORDER = [
    'ESTACA', 'BLOCO', 'PILAR', 'TRAVESSA', 'PILAR PROVISORIO',
    'LANCAMENTO VIGA', 'TRANSVERSINA', 'LANCAMENTO PRELAJE',
    'LAJE', 'LAJE ELASTICA', 'LAJE DE APROXIMACAO',
    'FABRICACAO VIGA', 'FABRICACAO PRELAJE',
    'CORTINA ATIRANTADA', 'SOLO GRAMPEADO', 'CBUQ',
];

const getServiceUnit = (service: string) => {
    if (['SOLO GRAMPEADO', 'CORTINA ATIRANTADA', 'PILAR'].includes(service)) return 'm';
    if (['CBUQ'].includes(service)) return 't';
    return 'un';
};

const fmt = (n: number) => Number.isInteger(n) ? n.toLocaleString('pt-BR') : Number(n).toFixed(1);
const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;
const aderClass = (p: number) => p > 95 ? 'text-green-500' : p >= 80 ? 'text-yellow-500' : 'text-red-500';
const aderHex = (p: number) => p > 95 ? '#22c55e' : p >= 80 ? '#eab308' : '#ef4444';

const DeviationsSummaryPage: React.FC<DeviationsSummaryPageProps> = (props) => {
    const { currentUser: user } = useData();
    const [rows, setRows] = useState<MonitoringRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusDate, setStatusDate] = useState('');

    const [baselineKey, setBaselineKey] = useState<'prev' | 'lb05'>('prev');
    const [selectedService, setSelectedService] = useState('ALL');
    const [selectedEng, setSelectedEng] = useState('ALL');
    const [detailService, setDetailService] = useState<string | null>(null);
    const { theme } = useTheme();

    const baselineLabel = baselineKey === 'lb05' ? 'LB05' : 'LB04';

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                let allRows: any[] = [];
                let from = 0;
                let hasMore = true;
                while (hasMore) {
                    const { data, error } = await supabase.from('monitoring_rows').select('*').neq('id', '_CONFIG_').range(from, from + 999).order('oae', { ascending: true });
                    if (data && data.length > 0) {
                        for (let i = 0; i < data.length; i++) allRows.push(data[i]);
                        if (data.length < 1000) hasMore = false;
                        else { from += 1000; await new Promise(r => setTimeout(r, 0)); }
                    } else hasMore = false;
                    if (error) hasMore = false;
                }
                if (allRows.length > 0) {
                    const mapped = allRows.map(r => ({
                        ...r,
                        responsible: (r.responsible === 'Bruno' || r.responsible === 'Bruno ') ? 'Bruno Bastos' : r.responsible,
                    }));
                    setRows(mapped);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
                } else {
                    const cached = localStorage.getItem(STORAGE_KEY);
                    if (cached) setRows(JSON.parse(cached));
                }
                const { data: cfg } = await supabase.from('monitoring_rows').select('daily_data').eq('id', '_CONFIG_').maybeSingle();
                if (cfg?.daily_data?.status_date) setStatusDate(cfg.daily_data.status_date);
                else {
                    const cachedDate = localStorage.getItem('@elos_monitoring_status_date');
                    if (cachedDate) setStatusDate(cachedDate);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const services = useMemo(() => {
        const srvs = Array.from(new Set(rows.map(r => r.service)) as Set<string>).sort((a, b) => {
            const ia = SERVICE_ORDER.indexOf(a), ib = SERVICE_ORDER.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
        return ['ALL', ...srvs];
    }, [rows]);

    const engineers = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.responsible || 'N/A'))).sort()], [rows]);

    const isoStatusDate = useMemo(() => {
        if (!statusDate) return '';
        if (statusDate.includes('/')) {
            const p = statusDate.split('/');
            if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
        }
        return statusDate;
    }, [statusDate]);

    const maxDataDate = useMemo(() => {
        let max = '';
        rows.forEach(r => Object.keys(r.daily_data || {}).forEach(d => { if (d > max) max = d; }));
        return max;
    }, [rows]);

    const cutDate = isoStatusDate || maxDataDate;
    const cutDateLabel = cutDate ? cutDate.split('-').reverse().join('/') : '—';

    const filteredRows = useMemo(() => rows.filter(r => {
        if (selectedService !== 'ALL' && r.service !== selectedService) return false;
        if (selectedEng !== 'ALL' && r.responsible !== selectedEng) return false;
        return true;
    }), [rows, selectedService, selectedEng]);

    /** Métrica acumulada de cada linha até a data status. */
    const computeRow = (r: MonitoringRow) => {
        let planned = 0, real = 0;
        Object.entries(r.daily_data || {}).forEach(([date, vals]) => {
            if (cutDate && date <= cutDate) {
                const v = vals as { prev: number; real: number; lb05?: number };
                planned += v[baselineKey] || 0;
                real += v.real || 0;
            }
        });
        const desvio = real - planned;
        const aderencia = planned > 0 ? (real / planned) * 100 : (real > 0 ? 100 : 0);
        return { planned, real, desvio, aderencia };
    };

    const TOL = 0.01;

    const analyzed = useMemo(() => {
        return filteredRows
            .map(r => ({ row: r, ...computeRow(r) }))
            .filter(x => x.planned > TOL || x.real > TOL);
    }, [filteredRows, baselineKey, cutDate]);

    const summary = useMemo(() => {
        const total = analyzed.length;
        const atrasados = analyzed.filter(a => a.desvio < -TOL);
        const adiantados = analyzed.filter(a => a.desvio > TOL);
        const comDesvio = atrasados.length + adiantados.length;
        const emDia = total - comDesvio;
        const aderMedia = total > 0 ? analyzed.reduce((s, a) => s + a.aderencia, 0) / total : 0;
        const pct = (n: number) => total > 0 ? (n / total) * 100 : 0;
        return {
            total,
            comDesvio, comDesvioPct: pct(comDesvio),
            atrasados: atrasados.length, atrasadosPct: pct(atrasados.length),
            adiantados: adiantados.length, adiantadosPct: pct(adiantados.length),
            emDia, emDiaPct: pct(emDia),
            aderMedia,
        };
    }, [analyzed]);

    /** Agrupamento por serviço (cada serviço tem unidade própria, quantidades são válidas). */
    const byService = useMemo(() => {
        const map: Record<string, { planned: number; real: number; total: number; atrasados: number }> = {};
        analyzed.forEach(a => {
            const s = a.row.service;
            if (!map[s]) map[s] = { planned: 0, real: 0, total: 0, atrasados: 0 };
            map[s].planned += a.planned;
            map[s].real += a.real;
            map[s].total += 1;
            if (a.desvio < -TOL) map[s].atrasados += 1;
        });
        return Object.entries(map)
            .map(([service, v]) => {
                const desvio = v.real - v.planned;
                const aderencia = v.planned > 0 ? (v.real / v.planned) * 100 : (v.real > 0 ? 100 : 0);
                return { service, ...v, desvio, aderencia, unit: getServiceUnit(service) };
            })
            .sort((a, b) => a.aderencia - b.aderencia);
    }, [analyzed]);

    /** Agrupamento por engenheiro (sem quantidade somada — unidades podem divergir). */
    const byEngineer = useMemo(() => {
        const map: Record<string, { planned: number; real: number; total: number; atrasados: number; adiantados: number }> = {};
        analyzed.forEach(a => {
            const e = a.row.responsible || 'N/A';
            if (!map[e]) map[e] = { planned: 0, real: 0, total: 0, atrasados: 0, adiantados: 0 };
            map[e].planned += a.planned;
            map[e].real += a.real;
            map[e].total += 1;
            if (a.desvio < -TOL) map[e].atrasados += 1;
            if (a.desvio > TOL) map[e].adiantados += 1;
        });
        return Object.entries(map)
            .map(([eng, v]) => {
                const aderencia = v.planned > 0 ? (v.real / v.planned) * 100 : (v.real > 0 ? 100 : 0);
                const comDesvio = v.atrasados + v.adiantados;
                return { eng, ...v, aderencia, comDesvio };
            })
            .sort((a, b) => b.atrasados - a.atrasados || a.aderencia - b.aderencia);
    }, [analyzed]);

    /** Itens mais críticos: atrasos ordenados pela pior aderência e maior desvio absoluto. */
    const criticalItems = useMemo(() => {
        return analyzed
            .filter(a => a.desvio < -TOL)
            .sort((a, b) => a.aderencia - b.aderencia || a.desvio - b.desvio)
            .slice(0, 12);
    }, [analyzed]);

    const chartData = useMemo(() => byService.map(s => ({
        name: s.service,
        fullName: s.service,
        aderencia: Number(s.aderencia.toFixed(1)),
    })), [byService]);

    /** Detalhe por vão/apoio do serviço selecionado no modal. */
    const detailItems = useMemo(() => {
        if (!detailService) return [];
        return analyzed
            .filter(a => a.row.service === detailService)
            .sort((a, b) => a.aderencia - b.aderencia || a.desvio - b.desvio);
    }, [detailService, analyzed]);

    const detailSummary = useMemo(() => byService.find(s => s.service === detailService) || null, [byService, detailService]);

    useEffect(() => {
        if (!detailService) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailService(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [detailService]);

    if (!user) return null;
    if (isLoading) return <div className="flex bg-[var(--dv-page)] h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-accent" /></div>;

    const isLight = theme === 'light';
    const chart = isLight
        ? { grid: 'rgba(15,23,42,0.08)', axis: '#94a3b8', label: '#475569', cursor: 'rgba(15,23,42,0.05)', tipBg: '#ffffff', tipBorder: 'rgba(15,23,42,0.12)', tipText: '#0f172a' }
        : { grid: 'rgba(255,255,255,0.04)', axis: '#4b5563', label: '#9ca3af', cursor: 'rgba(255,255,255,0.05)', tipBg: '#0a0f18', tipBorder: 'rgba(255,255,255,0.06)', tipText: '#e5e7eb' };

    return (
        <div className="flex h-screen bg-[var(--dv-page)] overflow-hidden text-[var(--dv-text)] font-sans">
            <Sidebar user={user} activeScreen="monitoringControl" {...props} />
            <main className="flex-1 overflow-y-auto relative custom-scrollbar">
                <div className="p-8 pb-12">
                    {/* HEADER */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><AlertTriangle size={24} /></div>
                                <h1 className="text-3xl font-black tracking-tight uppercase italic underline decoration-red-500 decoration-4 underline-offset-8">Resumo Desvios</h1>
                            </div>
                            <p className="text-brand-med-gray text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Análise gerencial de aderência ao planejamento</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={props.onNavigateToMonitoringDashboard} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600/90 hover:bg-blue-500 rounded-xl border border-blue-400/20 transition-all font-black text-[10px] uppercase tracking-wider shadow-2xl text-white">
                                <LayoutDashboard size={14} /> Analítico
                            </button>
                            <button onClick={props.onNavigateToMonitoringControl} className="flex items-center gap-2 px-6 py-2.5 bg-[var(--dv-subtle)] hover:bg-[var(--dv-hover)] rounded-xl border border-[var(--dv-border)] transition-all font-black text-[10px] uppercase tracking-wider shadow-2xl">
                                <ArrowLeft size={14} /> Voltar para Planilha
                            </button>
                        </div>
                    </div>

                    {/* FILTERS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-[var(--dv-glass)] backdrop-blur-3xl border border-[var(--dv-border)] rounded-3xl mb-4 shadow-2xl">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase flex items-center gap-1"><Target size={10} /> Linha Base de Referência</label>
                            <div className="flex gap-2">
                                {(['prev', 'lb05'] as const).map(k => {
                                    const active = baselineKey === k;
                                    const label = k === 'prev' ? 'LB04' : 'LB05';
                                    return (
                                        <button key={k} onClick={() => setBaselineKey(k)} className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wide transition-all ${active ? (k === 'lb05' ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300' : 'bg-gray-500/15 border-gray-400/60 text-[var(--dv-text-strong)]') : 'bg-[var(--dv-input)] border-[var(--dv-border)] text-[var(--dv-text-faint)] hover:border-[var(--dv-border-strong)]'}`}>{label}</button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase flex items-center gap-1"><Building2 size={10} /> Serviço</label>
                            <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} className="bg-[var(--dv-input)] border border-[var(--dv-border)] rounded-xl p-2.5 text-xs font-bold text-[var(--dv-text-strong)] outline-none focus:border-brand-accent transition-all">{services.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Todos os Serviços' : `${s} (${getServiceUnit(s)})`}</option>)}</select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase flex items-center gap-1"><User size={10} /> Engenheiro</label>
                            <select value={selectedEng} onChange={(e) => setSelectedEng(e.target.value)} className="bg-[var(--dv-input)] border border-[var(--dv-border)] rounded-xl p-2.5 text-xs font-bold text-[var(--dv-text-strong)] outline-none focus:border-brand-accent transition-all">{engineers.map(e => <option key={e} value={e}>{e === 'ALL' ? 'Todos os Engenheiros' : e}</option>)}</select>
                        </div>
                        <div className="flex flex-col gap-1.5 justify-end">
                            <label className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase flex items-center gap-1"><Activity size={10} /> Posição Acumulada Até</label>
                            <div className="bg-[var(--dv-input)] border border-[var(--dv-border)] rounded-xl p-2.5 text-xs font-black text-brand-accent">{cutDateLabel}</div>
                        </div>
                    </div>

                    <p className="text-[10px] text-[var(--dv-text-muted)] mb-8 px-1 leading-relaxed">
                        Desvio = <span className="text-[var(--dv-text)] font-bold">Realizado − {baselineLabel}</span> acumulado até a data status. Valores negativos indicam <span className="text-red-400 font-bold">atraso</span> em relação ao planejado; positivos indicam <span className="text-cyan-300 font-bold">adiantamento</span>.
                    </p>

                    {/* KPI CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                        <div className="p-6 bg-[var(--dv-surface)] border border-[var(--dv-border)] rounded-3xl shadow-2xl">
                            <p className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase mb-1 flex items-center gap-1"><ListChecks size={12} /> Itens Analisados</p>
                            <h3 className="text-4xl font-black text-[var(--dv-text-strong)]">{summary.total}</h3>
                            <p className="text-[10px] text-[var(--dv-text-faint)] mt-1 font-bold uppercase">{summary.emDia} em dia</p>
                        </div>
                        <div className="p-6 bg-[var(--dv-surface)] border border-orange-500/20 rounded-3xl shadow-2xl">
                            <p className="text-[10px] font-black text-orange-400 uppercase mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Com Desvio</p>
                            <h3 className="text-4xl font-black text-[var(--dv-text-strong)]">{summary.comDesvio}</h3>
                            <p className="text-[10px] text-orange-400/80 mt-1 font-black">{summary.comDesvioPct.toFixed(0)}% do total</p>
                        </div>
                        <div className="p-6 bg-[var(--dv-surface)] border border-red-500/20 rounded-3xl shadow-2xl">
                            <p className="text-[10px] font-black text-red-400 uppercase mb-1 flex items-center gap-1"><TrendingDown size={12} /> Atrasados</p>
                            <h3 className="text-4xl font-black text-red-500">{summary.atrasados}</h3>
                            <p className="text-[10px] text-red-400/80 mt-1 font-black">{summary.atrasadosPct.toFixed(0)}% do total</p>
                        </div>
                        <div className="p-6 bg-[var(--dv-surface)] border border-cyan-500/20 rounded-3xl shadow-2xl">
                            <p className="text-[10px] font-black text-cyan-400 uppercase mb-1 flex items-center gap-1"><TrendingUp size={12} /> Adiantados</p>
                            <h3 className="text-4xl font-black text-cyan-400">{summary.adiantados}</h3>
                            <p className="text-[10px] text-cyan-400/80 mt-1 font-black">{summary.adiantadosPct.toFixed(0)}% do total</p>
                        </div>
                        <div className="p-6 bg-[var(--dv-surface)] border border-[var(--dv-border)] rounded-3xl shadow-2xl">
                            <p className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase mb-1 flex items-center gap-1"><Gauge size={12} /> Aderência Média</p>
                            <h3 className={`text-4xl font-black ${aderClass(summary.aderMedia)}`}>{summary.aderMedia.toFixed(1)}%</h3>
                            <p className="text-[10px] text-[var(--dv-text-faint)] mt-1 font-bold uppercase">média dos itens</p>
                        </div>
                    </div>

                    {summary.total === 0 ? (
                        <div className="h-[300px] flex items-center justify-center border border-dashed border-[var(--dv-border)] rounded-3xl">
                            <span className="text-[var(--dv-text-muted)] font-bold text-xs uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={16} /> Nenhum item com atividade até a data status para os filtros selecionados</span>
                        </div>
                    ) : (
                    <>
                    {/* ADERÊNCIA POR SERVIÇO - CHART */}
                    <div className="p-8 bg-[var(--dv-surface)] border border-[var(--dv-border)] rounded-3xl shadow-2xl mb-8">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[var(--dv-text-strong)] mb-8 flex items-center gap-2"><Gauge size={16} className="text-brand-accent" /> Aderência por Serviço (%)</h4>
                        <div style={{ height: Math.max(220, chartData.length * 38) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                                    <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: chart.axis, fontSize: 10 }} unit="%" />
                                    <YAxis type="category" dataKey="name" width={185} interval={0} axisLine={false} tickLine={false} tick={(t: any) => {
                                        const { x, y, payload } = t;
                                        return <text x={x} y={y} dy={3} textAnchor="end" fill={chart.label} fontSize={10} fontWeight={700}>{payload.value}</text>;
                                    }} />
                                    <Tooltip cursor={{ fill: chart.cursor }} contentStyle={{ backgroundColor: chart.tipBg, border: `1px solid ${chart.tipBorder}`, borderRadius: '12px', color: chart.tipText }} itemStyle={{ color: chart.tipText }} labelStyle={{ color: chart.tipText }} formatter={(v: any) => [`${v}%`, 'Aderência']} labelFormatter={(_, p: any) => p?.[0]?.payload?.fullName || ''} />
                                    <Bar dataKey="aderencia" radius={[0, 6, 6, 0]} barSize={20}>
                                        {chartData.map((d, i) => <Cell key={i} fill={aderHex(d.aderencia)} />)}
                                        <LabelList dataKey="aderencia" position="right" formatter={(v: any) => `${v}%`} style={{ fill: chart.label, fontSize: 10, fontWeight: 700 }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* DESVIOS POR SERVIÇO - TABLE */}
                    <div className="p-8 bg-[var(--dv-surface)] border border-[var(--dv-border)] rounded-3xl shadow-2xl mb-8">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[var(--dv-text-strong)] mb-6 flex items-center gap-2"><Building2 size={16} className="text-brand-accent" /> Desvios por Serviço</h4>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[760px]">
                                <thead>
                                    <tr className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase border-b border-[var(--dv-border)]">
                                        <th className="pb-4">Serviço</th>
                                        <th className="pb-4 text-center">Itens</th>
                                        <th className="pb-4 text-center">Atrasados</th>
                                        <th className="pb-4 text-right">Previsto ({baselineLabel})</th>
                                        <th className="pb-4 text-right">Realizado</th>
                                        <th className="pb-4 text-right">Desvio</th>
                                        <th className="pb-4 text-right pr-2">Aderência</th>
                                        <th className="pb-4 w-[160px]">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--dv-border)]">
                                    {byService.map(s => (
                                        <tr key={s.service} onClick={() => setDetailService(s.service)} title="Ver detalhe por vão / apoio" className="group cursor-pointer hover:bg-[var(--dv-hover)] transition-colors">
                                            <td className="py-3 font-bold text-xs"><span className="inline-flex items-center gap-1.5"><ChevronRight size={13} className="text-[var(--dv-text-faint)] group-hover:text-brand-accent transition-colors" />{s.service} <span className="text-[9px] text-[var(--dv-text-muted)] font-normal">({s.unit})</span></span></td>
                                            <td className="py-3 text-center text-xs font-semibold text-[var(--dv-text-soft)]">{s.total}</td>
                                            <td className="py-3 text-center text-xs font-black text-red-500">{s.atrasados || '-'}</td>
                                            <td className="py-3 text-right text-xs font-semibold text-[var(--dv-text-soft)]">{fmt(s.planned)}</td>
                                            <td className="py-3 text-right text-xs font-black text-brand-accent">{fmt(s.real)}</td>
                                            <td className={`py-3 text-right text-xs font-black ${s.desvio < -0.01 ? 'text-red-500' : s.desvio > 0.01 ? 'text-cyan-400' : 'text-[var(--dv-text-soft)]'}`}>{fmtSigned(s.desvio)}</td>
                                            <td className={`py-3 text-right pr-2 text-xs font-black ${aderClass(s.aderencia)}`}>{s.aderencia.toFixed(0)}%</td>
                                            <td className="py-3">
                                                <div className="h-2 w-full rounded-full bg-[var(--dv-subtle)] overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.aderencia)}%`, background: aderHex(s.aderencia) }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
                        {/* ITENS CRÍTICOS */}
                        <div className="p-8 bg-[var(--dv-surface)] border border-red-500/10 rounded-3xl shadow-2xl lg:col-span-3 flex flex-col">
                            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--dv-text-strong)] mb-6 flex items-center gap-2"><TrendingDown size={16} className="text-red-500" /> Itens Críticos · Maiores Atrasos</h4>
                            {criticalItems.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-[var(--dv-text-faint)] text-xs font-bold uppercase tracking-widest py-10">Nenhum item atrasado 🎉</div>
                            ) : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-[520px]">
                                        <thead>
                                            <tr className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase border-b border-[var(--dv-border)]">
                                                <th className="pb-4">Obra / Apoio</th>
                                                <th className="pb-4">Serviço</th>
                                                <th className="pb-4 text-right">Prev ({baselineLabel})</th>
                                                <th className="pb-4 text-right">Real</th>
                                                <th className="pb-4 text-right">Desvio</th>
                                                <th className="pb-4 text-right pr-1">Ader.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--dv-border)]">
                                            {criticalItems.map((c, i) => (
                                                <tr key={c.row.id + i} className="hover:bg-[var(--dv-hover)]">
                                                    <td className="py-3 font-bold text-xs truncate max-w-[140px]">{c.row.oae} <span className="text-[9px] text-[var(--dv-text-muted)] font-normal">({c.row.apoio || '—'})</span><br /><span className="text-[9px] text-[var(--dv-text-faint)] font-normal">{c.row.responsible || 'N/A'}</span></td>
                                                    <td className="py-3 text-[10px] text-[var(--dv-text-soft)] font-semibold uppercase">{c.row.service}</td>
                                                    <td className="py-3 text-right text-xs font-semibold text-[var(--dv-text-soft)]">{fmt(c.planned)}</td>
                                                    <td className="py-3 text-right text-xs font-black text-brand-accent">{fmt(c.real)}</td>
                                                    <td className="py-3 text-right text-xs font-black text-red-500">{fmtSigned(c.desvio)}</td>
                                                    <td className={`py-3 text-right pr-1 text-xs font-black ${aderClass(c.aderencia)}`}>{c.aderencia.toFixed(0)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* POR ENGENHEIRO */}
                        <div className="p-8 bg-[var(--dv-surface)] border border-[var(--dv-border)] rounded-3xl shadow-2xl lg:col-span-2 flex flex-col">
                            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--dv-text-strong)] mb-6 flex items-center gap-2"><User size={16} className="text-brand-accent" /> Desvios por Engenheiro</h4>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[360px]">
                                    <thead>
                                        <tr className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase border-b border-[var(--dv-border)]">
                                            <th className="pb-4">Engenheiro</th>
                                            <th className="pb-4 text-center">Itens</th>
                                            <th className="pb-4 text-center">Atras.</th>
                                            <th className="pb-4 text-right pr-1">Aderência</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--dv-border)]">
                                        {byEngineer.map(e => (
                                            <tr key={e.eng} className="hover:bg-[var(--dv-hover)]">
                                                <td className="py-3 font-bold text-xs truncate max-w-[140px] text-[var(--dv-text)]">{e.eng}</td>
                                                <td className="py-3 text-center text-xs font-semibold text-[var(--dv-text-soft)]">{e.total}</td>
                                                <td className="py-3 text-center text-xs font-black text-red-500">{e.atrasados || '-'}</td>
                                                <td className={`py-3 text-right pr-1 text-xs font-black ${aderClass(e.aderencia)}`}>{e.aderencia.toFixed(0)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                </div>
            </main>

            {/* MODAL DETALHE POR VÃO / APOIO */}
            {detailService && detailSummary && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" role="presentation" onClick={() => setDetailService(null)}>
                    <div role="dialog" aria-modal="true" className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-[var(--dv-border-strong)] bg-[var(--dv-surface-2)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {/* Cabeçalho */}
                        <div className="flex items-start justify-between gap-4 p-6 border-b border-[var(--dv-border)]">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-brand-accent/20 rounded-lg text-brand-accent"><Building2 size={16} /></div>
                                    <h2 className="text-lg font-black uppercase italic tracking-tight text-[var(--dv-text-strong)]">{detailService} <span className="text-xs text-[var(--dv-text-muted)] not-italic">({detailSummary.unit})</span></h2>
                                </div>
                                <p className="text-[10px] text-[var(--dv-text-muted)] font-bold uppercase tracking-wider">Detalhe de desvios por vão / apoio · acumulado até {cutDateLabel}</p>
                            </div>
                            <button type="button" onClick={() => setDetailService(null)} className="shrink-0 p-2 rounded-lg border border-[var(--dv-border)] text-[var(--dv-text-soft)] hover:bg-[var(--dv-hover)] hover:text-[var(--dv-text-strong)] transition-colors" title="Fechar (Esc)"><X size={16} /></button>
                        </div>

                        {/* Resumo do serviço */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 border-b border-[var(--dv-border)]">
                            <div className="text-center"><p className="text-[9px] font-black text-[var(--dv-text-muted)] uppercase mb-0.5">Itens</p><p className="text-lg font-black text-[var(--dv-text-strong)]">{detailSummary.total}</p></div>
                            <div className="text-center"><p className="text-[9px] font-black text-red-400 uppercase mb-0.5">Atrasados</p><p className="text-lg font-black text-red-500">{fmt(Math.max(0, detailSummary.planned - detailSummary.real))}</p></div>
                            <div className="text-center"><p className="text-[9px] font-black text-[var(--dv-text-muted)] uppercase mb-0.5">Prev ({baselineLabel})</p><p className="text-lg font-black text-[var(--dv-text)]">{fmt(detailSummary.planned)}</p></div>
                            <div className="text-center"><p className="text-[9px] font-black text-brand-accent uppercase mb-0.5">Realizado</p><p className="text-lg font-black text-brand-accent">{fmt(detailSummary.real)}</p></div>
                            <div className="text-center"><p className="text-[9px] font-black text-[var(--dv-text-muted)] uppercase mb-0.5">Aderência</p><p className={`text-lg font-black ${aderClass(detailSummary.aderencia)}`}>{detailSummary.aderencia.toFixed(0)}%</p></div>
                        </div>

                        {/* Tabela de vãos */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-5">
                            <table className="w-full text-left border-collapse min-w-[560px]">
                                <thead className="sticky top-0 z-20 bg-[var(--dv-surface-2)] shadow-[0_1px_0_0_rgba(255,255,255,0.08)]">
                                    <tr className="text-[10px] font-black text-[var(--dv-text-muted)] uppercase">
                                        <th className="pt-5 pb-3 bg-[var(--dv-surface-2)]">Obra / Vão</th>
                                        <th className="pt-5 pb-3 bg-[var(--dv-surface-2)]">Engenheiro</th>
                                        <th className="pt-5 pb-3 text-right bg-[var(--dv-surface-2)]">Prev ({baselineLabel})</th>
                                        <th className="pt-5 pb-3 text-right bg-[var(--dv-surface-2)]">Real</th>
                                        <th className="pt-5 pb-3 text-right bg-[var(--dv-surface-2)]">Desvio</th>
                                        <th className="pt-5 pb-3 text-right pr-1 bg-[var(--dv-surface-2)]">Ader.</th>
                                        <th className="pt-5 pb-3 w-[110px] bg-[var(--dv-surface-2)]">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--dv-border)]">
                                    {detailItems.map((d, i) => (
                                        <tr key={d.row.id + i} className="hover:bg-[var(--dv-hover)]">
                                            <td className="py-2.5 font-bold text-xs">{d.row.oae || '—'} <span className="text-[9px] text-blue-400 font-black">{d.row.apoio || ''}</span></td>
                                            <td className="py-2.5 text-[10px] text-[var(--dv-text-soft)] font-semibold">{d.row.responsible || 'N/A'}</td>
                                            <td className="py-2.5 text-right text-xs font-semibold text-[var(--dv-text-soft)]">{fmt(d.planned)}</td>
                                            <td className="py-2.5 text-right text-xs font-black text-brand-accent">{fmt(d.real)}</td>
                                            <td className={`py-2.5 text-right text-xs font-black ${d.desvio < -0.01 ? 'text-red-500' : d.desvio > 0.01 ? 'text-cyan-400' : 'text-[var(--dv-text-soft)]'}`}>{fmtSigned(d.desvio)}</td>
                                            <td className={`py-2.5 text-right pr-1 text-xs font-black ${aderClass(d.aderencia)}`}>{d.aderencia.toFixed(0)}%</td>
                                            <td className="py-2.5">
                                                <div className="h-2 w-full rounded-full bg-[var(--dv-subtle)] overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.aderencia)}%`, background: aderHex(d.aderencia) }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeviationsSummaryPage;
