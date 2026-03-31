import React, { useState, useEffect, useMemo } from 'react';
import { User, MonitoringRow } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../context/DataProvider';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Save, Search, Calendar, ChevronRight, ChevronDown } from 'lucide-react';

interface MonitoringControlPageProps {
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
    onNavigateToHome?: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToCheckoutSummary?: () => void;
    onNavigateToOrgSummary?: () => void;
    onNavigateToTeams?: () => void;
    onNavigateToSystem?: () => void;
    onUpgradeClick: () => void;
    onAddTask?: () => void;
    onNavigateToMonitoringDashboard: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const STORAGE_KEY = '@elos_monitoring_data_v2';

const MonitoringControlPage: React.FC<MonitoringControlPageProps> = (props) => {
    const { onNavigateToMonitoringDashboard, showToast } = props;
    const { currentUser: user, signOut } = useData();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [monitoringRows, setMonitoringRows] = useState<MonitoringRow[]>([]);
    
    // UI States
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [selectedService, setSelectedService] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [statusDate, setStatusDate] = useState("31/03/2026");

    // Load Data (Consolidated logic)
    useEffect(() => {
        const load = async () => {
            setIsLoadingData(true);
            try {
                // 1. Check DB first (Priority)
                let allRows: any[] = [];
                let from = 0;
                let hasMore = true;
                while (hasMore) {
                    const { data, error } = await supabase
                        .from('monitoring_rows')
                        .select('*')
                        .neq('id', '_CONFIG_')
                        .range(from, from + 999)
                        .order('oae', { ascending: true });

                    if (data && data.length > 0) {
                        allRows = [...allRows, ...data];
                        if (data.length < 1000) hasMore = false;
                        else from += 1000;
                    } else hasMore = false;
                    if (error) { hasMore = false; }
                }

                if (allRows.length > 0) {
                    setMonitoringRows(allRows);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(allRows));
                    if (!selectedService) setSelectedService(allRows[0]?.service || "");
                } else {
                    // Fallback to cache/seed
                    const cached = localStorage.getItem(STORAGE_KEY);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        setMonitoringRows(parsed);
                        if (!selectedService) setSelectedService(parsed[0]?.service || "");
                    } else {
                        const seedRes = await fetch('/monitoring_seed.json');
                        if (seedRes.ok) {
                            const seed = await seedRes.json();
                            const formatted = seed.rows.map((r: any) => ({ ...r, daily_data: seed.dailyData[r.id] || {} }));
                            setMonitoringRows(formatted);
                            if (!selectedService) setSelectedService(formatted[0]?.service || "");
                        }
                    }
                }

                // Status Date
                const { data: config } = await supabase.from('monitoring_rows').select('daily_data').eq('id', '_CONFIG_').single();
                if (config?.daily_data?.status_date) setStatusDate(config.daily_data.status_date);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingData(false);
            }
        };
        load();
    }, []);

    // Derived Lists
    const services = useMemo(() => {
        const s = new Set<string>();
        monitoringRows.forEach(r => s.add(r.service));
        return Array.from(s).sort();
    }, [monitoringRows]);

    const filteredRows = useMemo(() => {
        return monitoringRows.filter(r => 
            r.service === selectedService && 
            (r.oae.toLowerCase().includes(searchTerm.toLowerCase()) || 
             r.apoio.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (r.responsible || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [monitoringRows, selectedService, searchTerm]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        monitoringRows.forEach(r => {
            Object.keys(r.daily_data || {}).forEach(dateStr => {
                const parts = dateStr.split('-');
                if (parts.length === 3) months.add(`${parts[0]}-${parts[1]}`);
            });
        });
        return Array.from(months).sort();
    }, [monitoringRows]);

    const getMonthDays = (monthKey: string) => {
        const [year, month] = monthKey.split('-');
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const days = [];
        for (let i = 1; i <= lastDay; i++) {
            days.push(`${year}-${month}-${String(i).padStart(2, '0')}`);
        }
        return days;
    };

    const getMonthTotal = (row: MonitoringRow, monthKey: string, type: 'prev' | 'real') => {
        let sum = 0;
        const days = getMonthDays(monthKey);
        days.forEach(d => {
            sum += row.daily_data?.[d]?.[type] || 0;
        });
        return sum;
    };

    const getGrandTotal = (row: MonitoringRow, type: 'prev' | 'real') => {
        let sum = 0;
        Object.values(row.daily_data || {}).forEach(vals => {
            sum += (vals as any)[type] || 0;
        });
        return sum;
    };

    const handleCellChange = (rowId: string, dateKey: string, type: 'prev' | 'real', value: string) => {
        const text = value.replace(',', '.');
        const num = parseFloat(text);
        setMonitoringRows(prev => prev.map(r => {
            if (r.id === rowId) {
                const newData = { ...r.daily_data };
                if (!newData[dateKey]) newData[dateKey] = { prev: 0, real: 0 };
                newData[dateKey] = { ...newData[dateKey], [type]: isNaN(num) ? 0 : num };
                return { ...r, daily_data: newData };
            }
            return r;
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await supabase.from('monitoring_rows').upsert(monitoringRows, { onConflict: 'id' });
            await supabase.from('monitoring_rows').upsert({ id: '_CONFIG_', daily_data: { status_date: statusDate } });
            showToast("Mudanças salvas!", "success");
            localStorage.setItem(STORAGE_KEY, JSON.stringify(monitoringRows));
        } catch (e) {
            showToast("Erro ao salvar.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingData) {
        return (
            <div className="flex bg-[#060a12] h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-accent"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden text-gray-100">
            <Sidebar user={user!} activeScreen="monitoringControl" {...(props as any)} />

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <Header title="Monitoramento e Controle" user={user!} onLogout={signOut} />
                
                <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
                    <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">Monitoramento e Controle</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-brand-accent font-bold uppercase">Data de Status:</span>
                                <input 
                                    type="text" value={statusDate} onChange={(e) => setStatusDate(e.target.value)}
                                    className="bg-brand-dark/50 border border-white/5 rounded px-2 py-0.5 text-xs font-bold text-white w-28 focus:border-brand-accent outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input 
                                    type="text" placeholder="Filtrar OAE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-brand-dark/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:border-brand-accent outline-none w-64"
                                />
                            </div>
                            <button onClick={onNavigateToMonitoringDashboard} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs uppercase">
                                <LayoutDashboard size={14} /> Dashboard
                            </button>
                            <button onClick={handleSave} disabled={isSaving} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase ${isSaving ? 'bg-gray-800' : 'bg-brand-accent hover:bg-brand-accent/90'}`}>
                                {isSaving ? <div className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" /> : <Save size={14} />}
                                {isSaving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </header>

                    <div className="flex overflow-x-auto gap-2 mb-4 scrollbar-hide">
                        {services.map(s => (
                            <button
                                key={s} onClick={() => setSelectedService(s)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${selectedService === s ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' : 'bg-brand-dark/40 text-gray-500 border border-white/5'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-hidden bg-[#0a0f18] rounded-2xl border border-white/5 flex flex-col">
                        <div className="overflow-auto custom-scrollbar flex-1 relative">
                            <table className="w-full border-separate border-spacing-0 text-[10px]">
                                <thead className="sticky top-0 z-40 bg-[#0a0f18]">
                                    {/* Row 1: Months */}
                                    <tr>
                                        <th rowSpan={2} className="sticky left-0 z-50 bg-[#0a0f18] p-3 border-b border-r border-white/10 w-[120px] text-left text-white first:rounded-tl-2xl">OAE</th>
                                        <th rowSpan={2} className="sticky left-[120px] z-50 bg-[#0a0f18] p-3 border-b border-r border-white/10 w-[80px] text-left">Apoio</th>
                                        <th rowSpan={2} className="sticky left-[200px] z-50 bg-[#0a0f18] p-3 border-b border-r border-white/10 w-[100px] text-left">Resp.</th>
                                        <th rowSpan={2} className="p-3 border-b border-r border-white/10 w-[40px] text-center">Info</th>
                                        <th rowSpan={2} className="p-3 border-b border-r border-white/10 w-[60px] text-center bg-brand-accent/5 font-black text-brand-accent">TOTAL</th>
                                        
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            const days = getMonthDays(m);
                                            return (
                                                <th 
                                                    key={m} colSpan={exp ? days.length + 1 : 1}
                                                    onClick={() => {
                                                        const n = new Set(expandedMonths);
                                                        if (n.has(m)) n.delete(m); else n.add(m);
                                                        setExpandedMonths(n);
                                                    }}
                                                    className="p-2 border-b border-r border-white/10 text-center cursor-pointer hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="flex items-center justify-center gap-1">
                                                        {exp ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                                        <span className="uppercase">{new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1])-1).toLocaleString('pt-BR', {month: 'short', year: '2-digit'})}</span>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                    {/* Row 2: Sub-headers */}
                                    <tr className="bg-black/20">
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            if (!exp) return <th key={`sub-${m}`} className="p-1 border-b border-r border-white/5 text-[8px] text-center text-gray-600">RESUMO</th>;
                                            const days = getMonthDays(m);
                                            return (
                                                <React.Fragment key={`sub-exp-${m}`}>
                                                    <th className="p-1 border-b border-r border-white/5 text-[9px] text-center bg-brand-accent/10 text-brand-accent">SUM</th>
                                                    {days.map(d => (
                                                        <th key={d} className="p-1 border-b border-r border-white/5 text-[8px] text-center font-medium w-[28px]">{d.split('-')[2]}</th>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-white/5">
                                    {filteredRows.map(row => (
                                        <React.Fragment key={row.id}>
                                            {/* PREV ROW */}
                                            <tr className="bg-[#0c121d] hover:bg-white/5 group transition-colors">
                                                <td rowSpan={2} className="sticky left-0 z-30 bg-[#0c121d] group-hover:bg-[#141b26] p-2 border-r border-white/5 text-white font-bold truncate">{row.oae}</td>
                                                <td rowSpan={2} className="sticky left-[120px] z-30 bg-[#0c121d] group-hover:bg-[#141b26] p-2 border-r border-white/5 text-gray-400 truncate">{row.apoio}</td>
                                                <td rowSpan={2} className="sticky left-[200px] z-30 bg-[#0c121d] group-hover:bg-[#141b26] p-2 border-r border-white/5 text-[9px] text-gray-500 truncate">{row.responsible}</td>
                                                <td className="p-1 border-r border-white/5 text-center text-[8px] font-black text-gray-600 bg-black/20">PREV</td>
                                                <td className="p-1 border-r border-white/5 text-center font-bold text-gray-500 bg-brand-dark/20">{getGrandTotal(row, 'prev')}</td>
                                                
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'prev');
                                                    if (!exp) return <td key={`p-${m}`} className="p-1 border-r border-white/5 text-center text-gray-600 bg-[#0a0f18]">{total}</td>;
                                                    
                                                    const days = getMonthDays(m);
                                                    return (
                                                        <React.Fragment key={`p-exp-${m}`}>
                                                            <td className="p-1 border-r border-white/5 text-center bg-brand-accent/5 text-brand-accent/40 font-black">{total}</td>
                                                            {days.map(d => (
                                                                <td key={d} className="p-0 border-r border-white/5 w-[28px] bg-black/5">
                                                                    <input 
                                                                        type="text" value={row.daily_data?.[d]?.prev || ''} 
                                                                        onChange={(e) => handleCellChange(row.id, d, 'prev', e.target.value)}
                                                                        className="w-full h-8 text-center bg-transparent border-none outline-none text-gray-500 focus:bg-white/5 focus:text-white"
                                                                    />
                                                                </td>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                            {/* REAL ROW */}
                                            <tr className="bg-[#111827] hover:bg-white/5 group transition-colors">
                                                <td className="p-1 border-r border-white/5 text-center text-[8px] font-black text-brand-accent bg-black/20">REAL</td>
                                                <td className="p-1 border-r border-white/5 text-center font-black text-brand-accent bg-brand-accent/5">{getGrandTotal(row, 'real')}</td>
                                                
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'real');
                                                    if (!exp) return <td key={`r-${m}`} className="p-1 border-r border-white/5 text-center text-brand-accent/60 bg-[#121c2e] font-bold">{total}</td>;
                                                    
                                                    const days = getMonthDays(m);
                                                    return (
                                                        <React.Fragment key={`r-exp-${m}`}>
                                                            <td className="p-1 border-r border-white/5 text-center bg-brand-accent/10 text-brand-accent font-black">{total}</td>
                                                            {days.map(d => (
                                                                <td key={d} className="p-0 border-r border-white/5 w-[28px] bg-[#121a28]">
                                                                    <input 
                                                                        type="text" value={row.daily_data?.[d]?.real || ''} 
                                                                        onChange={(e) => handleCellChange(row.id, d, 'real', e.target.value)}
                                                                        className="w-full h-8 text-center bg-transparent border-none outline-none text-white font-bold focus:bg-brand-accent/20 focus:text-brand-accent"
                                                                    />
                                                                </td>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MonitoringControlPage;
