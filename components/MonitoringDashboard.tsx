import React, { useState, useMemo, useEffect } from 'react';
import { 
    LayoutDashboard, 
    ArrowLeft, 
    Calendar, 
    User, 
    Building2, 
    TrendingUp, 
    Target, 
    CheckCircle2, 
    AlertTriangle 
} from 'lucide-react';
import { 
    ComposedChart,
    Bar,
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Legend
} from 'recharts';
import Sidebar from './Sidebar';
import { useData } from '../context/DataProvider';
import { MonitoringRow } from '../types';
import { supabase } from '../supabaseClient';

interface MonitoringDashboardProps {
    onNavigateToHome: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToMonitoringControl: () => void;
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

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = (props) => {
    const { currentUser: user } = useData();
    const [rows, setRows] = useState<MonitoringRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedService, setSelectedService] = useState('ALL');
    const [selectedOAE, setSelectedOAE] = useState('ALL');
    const [selectedEng, setSelectedEng] = useState('ALL');
    const [dateRange, setDateRange] = useState<[number, number]>([0, 0]);

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
                        allRows = [...allRows, ...data];
                        if (data.length < 1000) hasMore = false; else from += 1000;
                    } else hasMore = false;
                    if (error) hasMore = false;
                }
                if (allRows.length > 0) {
                    const mapped = allRows.map(r => ({
                        ...r,
                        responsible: (r.responsible === 'Bruno' || r.responsible === 'Bruno ') ? 'Bruno Bastos' : r.responsible
                    }));
                    setRows(mapped);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
                } else {
                    const cached = localStorage.getItem(STORAGE_KEY);
                    if (cached) setRows(JSON.parse(cached));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const services = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.service))).sort()], [rows]);
    const oaes = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.oae))).sort()], [rows]);
    const engineers = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.responsible || 'N/A'))).sort()], [rows]);
    const uniqueDates = useMemo(() => {
        const dateSet = new Set<string>();
        rows.forEach(r => Object.keys(r.daily_data || {}).forEach(d => dateSet.add(d)));
        return Array.from(dateSet).sort();
    }, [rows]);

    useEffect(() => {
        if (uniqueDates.length > 0 && dateRange[1] === 0) {
            setDateRange([0, uniqueDates.length - 1]);
        }
    }, [uniqueDates]);

    const startDate = uniqueDates[dateRange[0]];
    const endDate = uniqueDates[dateRange[1]];

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (selectedService !== 'ALL' && r.service !== selectedService) return false;
            if (selectedOAE !== 'ALL' && r.oae !== selectedOAE) return false;
            if (selectedEng !== 'ALL' && r.responsible !== selectedEng) return false;
            return true;
        });
    }, [rows, selectedService, selectedOAE, selectedEng]);

    const metrics = useMemo(() => {
        let totalPrev = 0, totalReal = 0;
        filteredRows.forEach(r => {
            Object.entries(r.daily_data || {}).forEach(([date, vals]) => {
                const v = vals as { prev: number; real: number };
                if (date >= startDate && date <= endDate) {
                    totalPrev += v.prev || 0;
                    totalReal += v.real || 0;
                }
            });
        });
        const progress = totalPrev > 0 ? (totalReal / totalPrev) * 100 : 0;
        const gap = totalReal - totalPrev;
        return { totalPrev, totalReal, progress, gap };
    }, [filteredRows, startDate, endDate]);

    const weeklyData = useMemo(() => {
        let cumPrev = 0, cumReal = 0;
        const weekMap: Record<string, { prev: number, real: number }> = {};

        const getSunday = (dStr: string) => {
            const d = new Date(dStr + 'T12:00:00');
            const day = d.getDay();
            const diff = d.getDate() - day;
            const sun = new Date(d.setDate(diff));
            return sun.toISOString().split('T')[0];
        };

        uniqueDates.filter(d => d >= startDate && d <= endDate).forEach(date => {
            const sun = getSunday(date);
            if (!weekMap[sun]) weekMap[sun] = { prev: 0, real: 0 };
            filteredRows.forEach(r => {
                const val = r.daily_data[date];
                if (val) {
                    weekMap[sun].prev += val.prev || 0;
                    weekMap[sun].real += val.real || 0;
                }
            });
        });

        return Object.keys(weekMap).sort().map(sunKey => {
            const w = weekMap[sunKey];
            cumPrev += w.prev;
            cumReal += w.real;
            return {
                name: sunKey.split('-').reverse().slice(0, 2).join('/'),
                prev: w.prev,
                real: w.real,
                cumPrev,
                cumReal
            };
        });
    }, [filteredRows, startDate, endDate, uniqueDates]);

    if (!user) return null;
    if (isLoading) return <div className="flex bg-[#060a12] h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-accent"></div></div>;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden text-gray-100 font-sans">
            <Sidebar user={user} activeScreen="monitoringControl" {...props} />
            <main className="flex-1 overflow-y-auto relative custom-scrollbar">
                <div className="p-8 pb-4">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-brand-accent/20 rounded-lg text-brand-accent"><LayoutDashboard size={24} /></div>
                                <h1 className="text-3xl font-black tracking-tight uppercase italic underline decoration-brand-accent decoration-4 underline-offset-8">Dashboard Operacional</h1>
                            </div>
                            <p className="text-brand-med-gray text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Monitoramento e Controle de Obras</p>
                        </div>
                        <button onClick={props.onNavigateToMonitoringControl} className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all font-black text-[10px] uppercase tracking-wider shadow-2xl">
                            <ArrowLeft size={14} /> Voltar para Planilha
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-[#0a0f18]/80 backdrop-blur-3xl border border-white/5 rounded-3xl mb-8 shadow-2xl">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><Building2 size={10} /> Serviço</label>
                            <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-brand-accent transition-all">
                                {services.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Todos os Serviços' : s}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><Target size={10} /> Obra de Arte (OAE)</label>
                            <select value={selectedOAE} onChange={(e) => setSelectedOAE(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-brand-accent transition-all">
                                {oaes.map(o => <option key={o} value={o}>{o === 'ALL' ? 'Todas as OAEs' : o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><User size={10} /> Engenheiro</label>
                            <select value={selectedEng} onChange={(e) => setSelectedEng(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-brand-accent transition-all">
                                {engineers.map(r => <option key={r} value={r}>{r === 'ALL' ? 'Todos os Engenheiros' : r}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><Calendar size={10} /> Linha do Tempo <span className="text-brand-accent ml-auto">{startDate?.split('-').reverse().join('/')} - {endDate?.split('-').reverse().join('/')}</span></label>
                            <div className="flex items-center gap-2 px-2 py-1">
                                <input type="range" min={0} max={uniqueDates.length > 0 ? uniqueDates.length - 1 : 0} value={dateRange[0]} onChange={(e) => setDateRange([parseInt(e.target.value), dateRange[1]])} className="flex-1 accent-brand-accent h-1.5 bg-white/5 rounded-full" />
                                <input type="range" min={0} max={uniqueDates.length > 0 ? uniqueDates.length - 1 : 0} value={dateRange[1]} onChange={(e) => setDateRange([dateRange[0], parseInt(e.target.value)])} className="flex-1 accent-white h-1.5 bg-white/5 rounded-full" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">Quantidade Prevista</p><h3 className="text-4xl font-black text-white">{metrics.totalPrev.toLocaleString()}</h3></div>
                        <div className="p-6 bg-[#0a0f18] border border-brand-accent/20 rounded-3xl shadow-2xl"><p className="text-[10px] font-black text-brand-accent uppercase mb-1">Quantidade Realizada</p><h3 className="text-4xl font-black text-white">{metrics.totalReal.toLocaleString()}</h3></div>
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">Aderência Médio (%)</p><h3 className={`text-4xl font-black ${metrics.progress >= 90 ? 'text-green-500' : metrics.progress >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>{metrics.progress.toFixed(1)}%</h3></div>
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden group"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">Diferença (GAP)</p><h3 className={`text-4xl font-black ${metrics.gap < 0 ? 'text-red-500' : metrics.gap > 0 ? 'text-green-500' : 'text-white'}`}>{metrics.gap > 0 ? '+' : ''}{metrics.gap.toLocaleString()}</h3></div>
                    </div>

                    <div className="p-8 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl mb-8">
                        <h4 className="text-xs font-black uppercase tracking-widest text-white mb-8 flex items-center gap-2"><TrendingUp size={16} className="text-brand-accent" /> Evolução Acumulada Semana a Semana (Dom - Sáb)</h4>
                        <div className="h-[450px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={weeklyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 10}} />
                                    <Tooltip contentStyle={{backgroundColor: '#0a0f18', border: '1px solid #ffffff10', borderRadius: '16px'}} />
                                    <Legend verticalAlign="top" height={36}/>
                                    <Bar dataKey="prev" name="Previsto Semana" fill="#1f2937" radius={[4, 4, 0, 0]} barSize={30} />
                                    <Bar dataKey="real" name="Realizado Semana" fill="#e35a10" radius={[4, 4, 0, 0]} barSize={30} />
                                    <Area type="monotone" dataKey="cumPrev" name="Previsto Acum." stroke="#4b5563" strokeWidth={2} strokeDasharray="5 5" fill="transparent" dot={false} />
                                    <Area type="monotone" dataKey="cumReal" name="Realizado Acum." stroke="#e35a10" strokeWidth={4} fill="transparent" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="p-8 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl overflow-hidden mb-8">
                         <h4 className="text-xs font-black uppercase tracking-widest text-white mb-8">Top Performance por Obra (OAE)</h4>
                         <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-black text-gray-500 uppercase border-b border-white/5">
                                        <th className="pb-4">OAE / Apoio</th>
                                        <th className="pb-4">Engenheiro</th>
                                        <th className="pb-4 text-center text-gray-400">Previsto Total</th>
                                        <th className="pb-4 text-center text-brand-accent">Realizado Total</th>
                                        <th className="pb-4 text-right">%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredRows.slice(0, 20).map(r => {
                                        const p = getGrandTotal(r, 'prev');
                                        const rv = getGrandTotal(r, 'real');
                                        const perc = p > 0 ? (rv / p) * 100 : 0;
                                        return (
                                            <tr key={r.id} className="hover:bg-white/5 group">
                                                <td className="py-4 font-bold text-sm">{r.oae} <span className="text-[10px] text-gray-500 font-normal">({r.apoio})</span></td>
                                                <td className="py-4 text-xs font-semibold text-gray-400">{r.responsible}</td>
                                                <td className="py-4 text-center font-bold text-gray-500">{p.toLocaleString()}</td>
                                                <td className="py-4 text-center font-black text-brand-accent">{rv.toLocaleString()}</td>
                                                <td className={`py-4 text-right font-black text-xs ${perc >= 100 ? 'text-green-500' : 'text-orange-500'}`}>{perc.toFixed(0)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                         </div>
                    </div>
                </div>
                <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-brand-accent/5 rounded-full blur-[150px] -z-10 pointer-events-none opacity-30"></div>
            </main>
        </div>
    );
};

const getGrandTotal = (row: MonitoringRow, type: 'prev' | 'real') => {
    let sum = 0;
    Object.values(row.daily_data || {}).forEach(vals => { sum += (vals as any)[type] || 0; });
    return sum;
};

export default MonitoringDashboard;
