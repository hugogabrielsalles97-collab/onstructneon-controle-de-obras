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
    Legend,
    LabelList
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
    const [statusDate, setStatusDate] = useState('');

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

                const { data: cfg } = await supabase.from('monitoring_rows').select('daily_data').eq('id', '_CONFIG_').maybeSingle();
                if (cfg?.daily_data?.status_date) {
                    setStatusDate(cfg.daily_data.status_date);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const uniqueDates = useMemo(() => {
        const dateSet = new Set<string>();
        rows.forEach(r => Object.keys(r.daily_data || {}).forEach(d => dateSet.add(d)));
        return Array.from(dateSet).sort();
    }, [rows]);

    useEffect(() => {
        if (uniqueDates.length > 0 && (dateRange[1] === 0 || dateRange[1] >= uniqueDates.length)) {
            setDateRange([0, uniqueDates.length - 1]);
        }
    }, [uniqueDates]);

    const startDate = uniqueDates[dateRange[0]];
    const endDate = uniqueDates[dateRange[1]];

    const handleDateInputChange = (val: string, index: 0 | 1) => {
        const targetDate = val;
        let bestIndex = -1;
        uniqueDates.forEach((d, i) => { if (d <= targetDate) bestIndex = i; });
        if (bestIndex !== -1) {
            const newRange: [number, number] = [dateRange[0], dateRange[1]];
            newRange[index] = bestIndex;
            setDateRange(newRange);
        }
    };

    const services = useMemo(() => {
        const serviceOrder = [
            'ESTACA', 'BLOCO', 'PILAR', 'TRAVESSA', 'PILAR PROVISORIO', 
            'LANCAMENTO VIGA', 'TRANSVERSINA', 'LANCAMENTO PRELAJE', 
            'LAJE', 'LAJE ELASTICA', 'LAJE DE APROXIMACAO', 
            'FABRICACAO VIGA', 'FABRICACAO PRELAJE'
        ];
        const srvs = Array.from(new Set(rows.map(r => r.service)) as Set<string>).sort((a, b) => {
            const idxA = serviceOrder.indexOf(a);
            const idxB = serviceOrder.indexOf(b);
            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        return ['ALL', ...srvs];
    }, [rows]);
    const oaes = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.oae))).sort()], [rows]);
    const engineers = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.responsible || 'N/A'))).sort()], [rows]);

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
        let cumPrev = 0, cumReal = 0;

        // Convert statusDate to ISO for comparison (it's normally DD/MM/YYYY in the spreadsheet UI, but the keys in daily_data are YYYY-MM-DD)
        // Actually, the statusDate in _CONFIG_ might be DD/MM/YYYY or YYYY-MM-DD.
        // Let's assume the daily_data keys are YYYY-MM-DD.
        let isoStatusDate = statusDate;
        if (statusDate.includes('/')) {
            const parts = statusDate.split('/');
            if (parts.length === 3) isoStatusDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        filteredRows.forEach(r => {
            Object.entries(r.daily_data || {}).forEach(([date, vals]) => {
                const v = vals as { prev: number; real: number };
                if (date >= startDate && date <= endDate) {
                    totalPrev += v.prev || 0;
                    totalReal += v.real || 0;
                }
                if (isoStatusDate && date <= isoStatusDate) {
                    cumPrev += v.prev || 0;
                    cumReal += v.real || 0;
                }
            });
        });
        const progress = totalPrev > 0 ? (totalReal / totalPrev) * 100 : (totalReal > 0 ? 100 : 0);
        return { 
            totalPrev, 
            totalReal, 
            progress, 
            periodGap: totalReal - totalPrev, // Back to Real - Prev
            cumGap: cumReal - cumPrev 
        };
    }, [filteredRows, startDate, endDate, statusDate]);

    const getPeriodTotal = (row: MonitoringRow, type: 'prev' | 'real') => {
        let sum = 0;
        Object.entries(row.daily_data || {}).forEach(([date, vals]) => {
            if (date >= startDate && date <= endDate) {
                sum += (vals as any)[type] || 0;
            }
        });
        return sum;
    };

    const weeklyData = useMemo(() => {
        let cumPrev = 0, cumReal = 0;
        const weekMap: Record<string, { prev: number, real: number }> = {};
        const getSaturdayEnd = (dStr: string) => {
            const d = new Date(dStr + 'T12:00:00');
            const day = d.getDay();
            const diff = 6 - day;
            const sat = new Date(d);
            sat.setDate(d.getDate() + diff);
            return sat.toISOString().split('T')[0];
        };
        uniqueDates.filter(d => d >= startDate && d <= endDate).forEach(date => {
            const sat = getSaturdayEnd(date);
            if (!weekMap[sat]) weekMap[sat] = { prev: 0, real: 0 };
            filteredRows.forEach(r => {
                const val = r.daily_data[date];
                if (val) {
                    weekMap[sat].prev += val.prev || 0;
                    weekMap[sat].real += val.real || 0;
                }
            });
        });
        return Object.keys(weekMap).sort().map(satKey => {
            const w = weekMap[satKey];
            cumPrev += w.prev; cumReal += w.real;
            return { name: satKey.split('-').reverse().slice(0, 2).join('/'), prev: w.prev, real: w.real, cumPrev, cumReal };
        });
    }, [filteredRows, startDate, endDate, uniqueDates]);

    const rankingRows = useMemo(() => {
        return filteredRows
            .map(r => ({ ...r, pTotal: getPeriodTotal(r, 'prev'), rTotal: getPeriodTotal(r, 'real') }))
            .filter(r => r.pTotal > 0 || r.rTotal > 0)
            .sort((a, b) => b.rTotal - a.rTotal);
    }, [filteredRows, startDate, endDate]);

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
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><Building2 size={10} /> Serviço</label><select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-brand-accent transition-all">{services.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Todos os Serviços' : s}</option>)}</select></div>
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><Target size={10} /> Obra de Arte (OAE)</label><select value={selectedOAE} onChange={(e) => setSelectedOAE(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-brand-accent transition-all">{oaes.map(o => <option key={o} value={o}>{o === 'ALL' ? 'Todas as OAEs' : o}</option>)}</select></div>
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><User size={10} /> Engenheiro</label><select value={selectedEng} onChange={(e) => setSelectedEng(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white outline-none focus:border-brand-accent transition-all">{engineers.map(r => <option key={r} value={r}>{r === 'ALL' ? 'Todos os Engenheiros' : r}</option>)}</select></div>
                        <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1"><Calendar size={10} /> Linha do Tempo</label>
                            <div className="flex items-center gap-2 mb-2"><input type="date" value={startDate || ''} onChange={(e) => handleDateInputChange(e.target.value, 0)} className="bg-black/40 border border-white/10 rounded-lg p-1 text-[10px] text-brand-accent outline-none font-bold" /><span className="text-gray-500 text-[10px]">-</span><input type="date" value={endDate || ''} onChange={(e) => handleDateInputChange(e.target.value, 1)} className="bg-black/40 border border-white/10 rounded-lg p-1 text-[10px] text-white outline-none font-bold" /></div>
                            <div className="flex items-center gap-2 px-2 py-1"><input type="range" min={0} max={uniqueDates.length > 0 ? uniqueDates.length - 1 : 0} value={dateRange[0]} onChange={(e) => setDateRange([parseInt(e.target.value), dateRange[1]])} className="flex-1 accent-brand-accent h-1.5 bg-white/5 rounded-full" /><input type="range" min={0} max={uniqueDates.length > 0 ? uniqueDates.length - 1 : 0} value={dateRange[1]} onChange={(e) => setDateRange([dateRange[0], parseInt(e.target.value)])} className="flex-1 accent-white h-1.5 bg-white/5 rounded-full" /></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">Quantidade Prevista</p><h3 className="text-4xl font-black text-white">{metrics.totalPrev.toLocaleString()}</h3></div>
                        <div className="p-6 bg-[#0a0f18] border border-brand-accent/20 rounded-3xl shadow-2xl"><p className="text-[10px] font-black text-brand-accent uppercase mb-1">Quantidade Realizada</p><h3 className="text-4xl font-black text-white">{metrics.totalReal.toLocaleString()}</h3></div>
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">Aderência Médio (%)</p><h3 className={`text-4xl font-black ${metrics.progress >= 90 ? 'text-green-500' : metrics.progress >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>{metrics.progress.toFixed(1)}%</h3></div>
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden group"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">Diferença no período</p><h3 className={`text-4xl font-black ${metrics.periodGap < 0 ? 'text-red-500' : metrics.periodGap > 0 ? 'text-green-500' : 'text-white'}`}>{metrics.periodGap > 0 ? '+' : ''}{metrics.periodGap.toLocaleString()}</h3></div>
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden group"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">Diferença acumulada</p><h3 className={`text-4xl font-black ${metrics.cumGap < 0 ? 'text-red-500' : metrics.cumGap > 0 ? 'text-green-500' : 'text-white'}`}>{metrics.cumGap > 0 ? '+' : ''}{metrics.cumGap.toLocaleString()}</h3></div>
                    </div>

                    <div className="p-8 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl mb-8">
                        <h4 className="text-xs font-black uppercase tracking-widest text-white mb-8 flex items-center gap-2"><TrendingUp size={16} className="text-brand-accent" /> Evolução Semanal vs Acumulado</h4>
                        <div className="h-[450px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={weeklyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 10}} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 10}} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#e35a10', fontSize: 10}} />
                                    <Tooltip contentStyle={{backgroundColor: '#0a0f18', border: '1px solid #ffffff10', borderRadius: '16px'}} />
                                    <Legend verticalAlign="top" height={36}/>
                                    <Bar yAxisId="left" dataKey="prev" name="Previsto Semanal" fill="#374151" radius={[4, 4, 0, 0]} barSize={25}><LabelList dataKey="prev" position="top" content={(props: any) => {const { x, y, width, value, index } = props; if (index === undefined || !weeklyData[index] || value === 0 || value === weeklyData[index].real) return null; return <text x={x + width / 2} y={y - 5} fill="#4b5563" fontSize={9} fontWeight="bold" textAnchor="middle">{value}</text>; }} /></Bar>
                                    <Bar yAxisId="left" dataKey="real" name="Realizado Semanal" fill="#ea580c" radius={[4, 4, 0, 0]} barSize={25}><LabelList dataKey="real" position="top" style={{fontSize: 9, fill: '#ea580c', fontWeight: 'bold'}} /></Bar>
                                    <Area yAxisId="right" type="monotone" dataKey="cumPrev" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" fill="transparent" dot={false} /><Area yAxisId="right" type="monotone" dataKey="cumReal" stroke="#e35a10" strokeWidth={2} fill="transparent" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div className="p-8 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
                             <h4 className="text-xs font-black uppercase tracking-widest text-white mb-6">Performance por Obra (OAE)</h4>
                             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#0a0f18] z-10 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]"><tr className="text-[10px] font-black text-gray-500 uppercase border-b border-white/5"><th className="pb-4">OAE / Apoio</th><th className="pb-4 text-center">Prev.</th><th className="pb-4 text-center">Real.</th><th className="pb-4 text-right">Ader.</th></tr></thead>
                                    <tbody className="divide-y divide-white/5">
                                        {rankingRows.map(r => {
                                            const p = r.pTotal; const rv = r.rTotal;
                                            const perc = p > 0 ? (rv / p) * 100 : (rv > 0 ? 100 : 0);
                                            return (
                                                <tr key={r.id} className="hover:bg-white/5 group">
                                                    <td className="py-3 font-bold text-xs truncate max-w-[120px]">{r.oae} <span className="text-[9px] text-gray-500 font-normal">({r.apoio})</span></td>
                                                    <td className="py-3 text-center text-xs font-semibold text-gray-400">{p}</td>
                                                    <td className="py-3 text-center text-xs font-black text-brand-accent">{rv}</td>
                                                    <td className={`py-3 text-right font-black text-xs ${perc >= 100 ? 'text-green-500' : 'text-orange-500'}`}>{perc.toFixed(0)}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                             </div>
                        </div>

                        <div className="p-8 bg-[#0a0f18] border border-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
                             <h4 className="text-xs font-black uppercase tracking-widest text-white mb-6">Performance por Engenheiro</h4>
                             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#0a0f18] z-10 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]"><tr className="text-[10px] font-black text-gray-500 uppercase border-b border-white/5"><th className="pb-4">Engenheiro</th><th className="pb-4 text-center">Prev.</th><th className="pb-4 text-center">Real.</th><th className="pb-4 text-right">%</th></tr></thead>
                                    <tbody className="divide-y divide-white/5">
                                        {Array.from(new Set(filteredRows.map(r => r.responsible))).filter(Boolean).map(eng => {
                                            const engRows = filteredRows.filter(r => r.responsible === eng);
                                            const p = engRows.reduce((acc, r) => acc + getPeriodTotal(r, 'prev'), 0);const rv = engRows.reduce((acc, r) => acc + getPeriodTotal(r, 'real'), 0);
                                            if (p === 0 && rv === 0) return null; const perc = p > 0 ? (rv / p) * 100 : (rv > 0 ? 100 : 0);
                                            return (
                                                <tr key={eng} className="hover:bg-white/5 group">
                                                    <td className="py-3 font-bold text-xs truncate max-w-[150px] text-gray-300">{eng}</td><td className="py-3 text-center text-xs font-semibold text-gray-400">{p}</td><td className="py-3 text-center text-xs font-black text-brand-accent">{rv}</td><td className={`py-3 text-right font-black text-xs ${perc >= 100 ? 'text-green-500' : 'text-orange-500'}`}>{perc.toFixed(0)}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MonitoringDashboard;
