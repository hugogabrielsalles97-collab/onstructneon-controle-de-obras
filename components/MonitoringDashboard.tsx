
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
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    AreaChart, 
    Area, 
    BarChart, 
    Bar, 
    Legend, 
    Cell 
} from 'recharts';
import Sidebar from './Sidebar';
import { useData } from '../context/DataProvider';
import { MonitoringRow } from '../types';

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

const STORAGE_KEY = 'monitoring_data_v1';

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = (props) => {
    const { currentUser: user } = useData();
    const [rows, setRows] = useState<MonitoringRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [selectedService, setSelectedService] = useState('ALL');
    const [selectedOAE, setSelectedOAE] = useState('ALL');
    const [selectedResp, setSelectedResp] = useState('ALL');
    
    // Date Range (Stored as indices in uniqueDates array)
    const [dateRange, setDateRange] = useState<[number, number]>([0, 0]);

    // Load Data
    useEffect(() => {
        const load = async () => {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                setRows(JSON.parse(cached));
            }
            setIsLoading(false);
        };
        load();
    }, []);

    // Derived Data for Filters
    const services = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.service))).sort()], [rows]);
    const oaes = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.oae))).sort()], [rows]);
    const responsibles = useMemo(() => ['ALL', ...Array.from(new Set(rows.map(r => r.responsible || 'N/A'))).sort()], [rows]);
    
    const uniqueDates = useMemo(() => {
        const dateSet = new Set<string>();
        rows.forEach(r => Object.keys(r.daily_data).forEach(d => dateSet.add(d)));
        const sorted = Array.from(dateSet).sort();
        return sorted;
    }, [rows]);

    useEffect(() => {
        if (uniqueDates.length > 0 && dateRange[1] === 0) {
            setDateRange([0, uniqueDates.length - 1]);
        }
    }, [uniqueDates]);

    const startDate = uniqueDates[dateRange[0]];
    const endDate = uniqueDates[dateRange[1]];

    // Filtered Rows
    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (selectedService !== 'ALL' && r.service !== selectedService) return false;
            if (selectedOAE !== 'ALL' && r.oae !== selectedOAE) return false;
            if (selectedResp !== 'ALL' && r.responsible !== selectedResp) return false;
            return true;
        });
    }, [rows, selectedService, selectedOAE, selectedResp]);

    // Metrics Calculation
    const metrics = useMemo(() => {
        let totalPrev = 0;
        let totalReal = 0;

        filteredRows.forEach(r => {
            Object.entries(r.daily_data).forEach(([date, vals]) => {
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

    // Chart Data: Accumulation over time
    const chartData = useMemo(() => {
        let cumPrev = 0;
        let cumReal = 0;
        
        return uniqueDates
            .filter(d => d >= startDate && d <= endDate)
            .map(date => {
                let dayPrev = 0;
                let dayReal = 0;
                
                filteredRows.forEach(r => {
                    const data = r.daily_data[date];
                    if (data) {
                        dayPrev += data.prev || 0;
                        dayReal += data.real || 0;
                    }
                });

                cumPrev += dayPrev;
                cumReal += dayReal;

                return {
                    date: date.split('-').reverse().slice(0, 2).join('/'), // DD/MM
                    prev: dayPrev,
                    real: dayReal,
                    cumPrev,
                    cumReal
                };
            });
    }, [filteredRows, startDate, endDate, uniqueDates]);

    // Service Breakdown Chart
    const serviceData = useMemo(() => {
        if (selectedService !== 'ALL') return [];
        const map: Record<string, { service: string, prev: number, real: number }> = {};
        
        filteredRows.forEach(r => {
            if (!map[r.service]) map[r.service] = { service: r.service, prev: 0, real: 0 };
            Object.entries(r.daily_data).forEach(([date, vals]) => {
                const v = vals as { prev: number; real: number };
                if (date >= startDate && date <= endDate) {
                    map[r.service].prev += v.prev || 0;
                    map[r.service].real += v.real || 0;
                }
            });
        });

        return Object.values(map).sort((a, b) => b.prev - a.prev);
    }, [filteredRows, startDate, endDate, selectedService]);

    if (!user) return null;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden text-gray-100 font-sans">
            <Sidebar user={user} activeScreen="monitoringControl" {...props} />

            <main className="flex-1 overflow-y-auto relative custom-scrollbar">
                {/* Header Section */}
                <div className="p-8 pb-4">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-brand-accent/20 rounded-lg text-brand-accent">
                                    <LayoutDashboard size={24} />
                                </div>
                                <h1 className="text-3xl font-black tracking-tight uppercase italic underline decoration-brand-accent decoration-4 underline-offset-8">
                                    Dashboard Operacional
                                </h1>
                            </div>
                            <p className="text-brand-med-gray text-xs font-bold uppercase tracking-[0.2em] opacity-60">
                                Monitoramento e Controle de Obras
                            </p>
                        </div>

                        <button 
                            onClick={props.onNavigateToMonitoringControl}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all font-bold text-xs uppercase"
                        >
                            <ArrowLeft size={16} />
                            Voltar para Planilha
                        </button>
                    </div>

                    {/* Filters Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#0a0f18]/60 backdrop-blur-xl border border-white/5 rounded-2xl mb-8">
                        {/* Service Filter */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                                <Building2 size={10} /> Serviço
                            </label>
                            <select 
                                value={selectedService}
                                onChange={(e) => setSelectedService(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50 transition-colors"
                            >
                                {services.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Todos os Serviços' : s}</option>)}
                            </select>
                        </div>

                        {/* OAE Filter */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                                <Target size={10} /> Obra de Arte (OAE)
                            </label>
                            <select 
                                value={selectedOAE}
                                onChange={(e) => setSelectedOAE(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50 transition-colors"
                            >
                                {oaes.map(o => <option key={o} value={o}>{o === 'ALL' ? 'Todas as OAEs' : o}</option>)}
                            </select>
                        </div>

                        {/* Responsible Filter */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                                <User size={10} /> Responsável
                            </label>
                            <select 
                                value={selectedResp}
                                onChange={(e) => setSelectedResp(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50 transition-colors"
                            >
                                {responsibles.map(r => <option key={r} value={r}>{r === 'ALL' ? 'Todos os Responsáveis' : r}</option>)}
                            </select>
                        </div>

                        {/* Date Slider */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1">
                                <Calendar size={10} /> Linha do Tempo: <span className="text-white ml-auto">{startDate?.split('-').reverse().join('/')} - {endDate?.split('-').reverse().join('/')}</span>
                            </label>
                            <div className="flex items-center gap-2 px-2 py-1">
                                <input 
                                    type="range"
                                    min={0}
                                    max={uniqueDates.length > 0 ? uniqueDates.length - 1 : 0}
                                    value={dateRange[0]}
                                    onChange={(e) => setDateRange([parseInt(e.target.value), dateRange[1]])}
                                    className="flex-1 accent-brand-accent hover:accent-brand-accent/80"
                                />
                                <input 
                                    type="range"
                                    min={0}
                                    max={uniqueDates.length > 0 ? uniqueDates.length - 1 : 0}
                                    value={dateRange[1]}
                                    onChange={(e) => setDateRange([dateRange[0], parseInt(e.target.value)])}
                                    className="flex-1 accent-white hover:accent-white/80"
                                />
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="p-6 bg-gradient-to-br from-[#111827] to-[#0a0f18] border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <TrendingUp size={64} className="text-gray-400" />
                            </div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Quantidade Prevista</p>
                            <h3 className="text-3xl font-black text-white">{metrics.totalPrev.toLocaleString()}</h3>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-[#111827] to-[#0a0f18] border border-brand-accent/20 rounded-2xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-brand-accent">
                                <CheckCircle2 size={64} />
                            </div>
                            <p className="text-[10px] font-black text-brand-accent uppercase tracking-widest mb-1 font-bold">Quantidade Realizada</p>
                            <h3 className="text-3xl font-black text-white">{metrics.totalReal.toLocaleString()}</h3>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-[#111827] to-[#0a0f18] border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden group">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Aderência Médio (%)</p>
                            <div className="flex items-end gap-2">
                                <h3 className={`text-3xl font-black ${metrics.progress >= 90 ? 'text-green-500' : metrics.progress >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {metrics.progress.toFixed(1)}%
                                </h3>
                                <span className={`text-xs font-bold mb-1 ${metrics.progress >= 100 ? 'text-green-400' : 'text-orange-400'}`}>
                                    {metrics.progress >= 100 ? 'No Alvo' : 'Abaixo da meta'}
                                </span>
                            </div>
                            <div className="mt-3 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${metrics.progress >= 90 ? 'bg-green-500' : metrics.progress >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, metrics.progress)}%` }}
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-[#111827] to-[#0a0f18] border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <AlertTriangle size={64} className={metrics.gap < 0 ? "text-red-500" : "text-green-500"} />
                            </div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Diferença (GAP)</p>
                            <h3 className={`text-3xl font-black ${metrics.gap < 0 ? 'text-red-500' : metrics.gap > 0 ? 'text-green-500' : 'text-white'}`}>
                                {metrics.gap > 0 ? '+' : ''}{metrics.gap.toLocaleString()}
                            </h3>
                            <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold">Baseado no intervalo selecionado</p>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Cumulative Evolution */}
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl">
                            <h4 className="text-sm font-black uppercase tracking-tight text-white mb-6 flex items-center gap-2">
                                <TrendingUp size={16} className="text-brand-accent" /> Evolução Acumulada (PPC)
                            </h4>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4b5563" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#4b5563" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#e35a10" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#e35a10" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#6b7280', fontSize: 10}}
                                            interval={Math.floor(chartData.length / 8)}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#6b7280', fontSize: 10}}
                                        />
                                        <Tooltip 
                                            contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px'}}
                                            itemStyle={{fontSize: '11px', fontWeight: 'bold'}}
                                            labelStyle={{color: '#94a3b8', fontSize: '10px', marginBottom: '4px'}}
                                        />
                                        <Area type="monotone" dataKey="cumPrev" name="Previsto Acum." stroke="#4b5563" strokeWidth={2} fillOpacity={1} fill="url(#colorPrev)" />
                                        <Area type="monotone" dataKey="cumReal" name="Realizado Acum." stroke="#e35a10" strokeWidth={3} fillOpacity={1} fill="url(#colorReal)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Performance by Service */}
                        <div className="p-6 bg-[#0a0f18] border border-white/5 rounded-3xl">
                            <h4 className="text-sm font-black uppercase tracking-tight text-white mb-6 flex items-center gap-2">
                                <Building2 size={16} className="text-brand-accent" /> Desempenho por Serviço
                            </h4>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={serviceData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 10}} />
                                        <YAxis 
                                            dataKey="service" 
                                            type="category" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            width={140}
                                            tick={{fill: '#fff', fontSize: 9, fontWeight: 'bold'}}
                                        />
                                        <Tooltip 
                                            cursor={{fill: '#ffffff02'}}
                                            contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px'}}
                                        />
                                        <Bar dataKey="prev" name="Previsto" fill="#1f2937" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="real" name="Realizado" fill="#e35a10" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Table: Records List */}
                    <div className="bg-[#0a0f18] border border-white/5 rounded-3xl overflow-hidden mb-8">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h4 className="text-sm font-black uppercase tracking-tight text-white">Top Performance por Obra (OAE)</h4>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">{filteredRows.length} combinações encontradas</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-black/20 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                        <th className="p-4 border-r border-white/5">OAE / Apoio</th>
                                        <th className="p-4 border-r border-white/5">Serviço</th>
                                        <th className="p-4 border-r border-white/5">Responsável</th>
                                        <th className="p-4 border-r border-white/5 text-center text-gray-400">Previsto</th>
                                        <th className="p-4 border-r border-white/5 text-center text-brand-accent">Realizado</th>
                                        <th className="p-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredRows.slice(0, 10).map(r => {
                                        const p = getGrandTotal(r, 'prev');
                                        const r_val = getGrandTotal(r, 'real');
                                        const perc = p > 0 ? (r_val / p) * 100 : 0;
                                        return (
                                            <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-4 font-bold text-sm">
                                                    <span className="text-white">{r.oae}</span>
                                                    <span className="text-gray-500 text-xs ml-2 opacity-60">({r.apoio})</span>
                                                </td>
                                                <td className="p-4 text-xs font-medium text-gray-400 uppercase tracking-tighter">{r.service}</td>
                                                <td className="p-4 text-xs text-gray-500">{r.responsible || 'N/A'}</td>
                                                <td className="p-4 text-center font-bold text-gray-400">{p.toLocaleString()}</td>
                                                <td className="p-4 text-center font-black text-brand-accent">{r_val.toLocaleString()}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden min-w-[60px]">
                                                            <div 
                                                                className={`h-full ${perc >= 100 ? 'bg-green-500' : perc >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                                                style={{ width: `${Math.min(100, perc)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-[10px] font-black ${perc >= 100 ? 'text-green-500' : 'text-gray-400'}`}>
                                                            {perc.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {filteredRows.length > 10 && (
                            <div className="p-4 text-center border-t border-white/5">
                                <p className="text-[10px] font-bold text-gray-500 uppercase italic">Mostrando apenas os 10 primeiros registros. Use os filtros para refinar.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Decorative Pattern */}
                <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-brand-accent/5 rounded-full blur-[150px] -z-10 pointer-events-none opacity-50"></div>
            </main>
        </div>
    );
};

const getGrandTotal = (row: MonitoringRow, type: 'prev' | 'real') => {
    let sum = 0;
    Object.values(row.daily_data || {}).forEach(vals => {
        sum += (vals as any)[type] || 0;
    });
    return sum;
};

export default MonitoringDashboard;
