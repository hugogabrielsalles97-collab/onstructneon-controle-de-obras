import React, { useState, useEffect, useMemo } from 'react';
import { User, MonitoringRow } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../context/DataProvider';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Save, Search, Calendar } from 'lucide-react';

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

const MonitoringControlPage: React.FC<MonitoringControlPageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToMonitoringControl,
    onNavigateToWarRoom,
    onNavigateToPodcast,
    onNavigateToCost,
    onNavigateToHome,
    onUpgradeClick,
    onNavigateToOrgChart,
    onNavigateToOrgSummary,
    onNavigateToVisualControl,
    onNavigateToCheckoutSummary,
    onNavigateToTeams,
    onNavigateToSystem,
    onAddTask,
    onNavigateToMonitoringDashboard,
    showToast
}) => {
    const { currentUser: user, signOut } = useData();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [monitoringRows, setMonitoringRows] = useState<MonitoringRow[]>([]);
    
    // UI States
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [selectedService, setSelectedService] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [statusDate, setStatusDate] = useState("31/03/2026");

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                // 1. Try Seed (as background check, optional)
                const seedRes = await fetch('/monitoring_seed.json');
                if (seedRes.ok) {
                    const seed = await seedRes.json();
                    if (seed.rows && seed.rows.length > 0) {
                        const formattedRows = seed.rows.map((r: any) => ({
                            ...r,
                            daily_data: seed.dailyData[r.id] || {}
                        }));
                        setMonitoringRows(formattedRows);
                        if (!selectedService) setSelectedService(formattedRows[0]?.service || "");
                    }
                }

                // 2. Load Rows from DB (Handling potential 1000-row limit)
                let allRows: any[] = [];
                let from = 0;
                let to = 999;
                let hasMore = true;

                while (hasMore) {
                    const { data: dbData, error: dbErr } = await supabase
                        .from('monitoring_rows')
                        .select('*')
                        .neq('id', '_CONFIG_')
                        .range(from, to)
                        .order('oae', { ascending: true });

                    if (dbData && dbData.length > 0) {
                        allRows = [...allRows, ...dbData];
                        if (dbData.length < 1000) {
                            hasMore = false;
                        } else {
                            from += 1000;
                            to += 1000;
                        }
                    } else {
                        hasMore = false;
                    }

                    if (dbErr) {
                        console.error("Fetch range error:", dbErr);
                        hasMore = false;
                    }
                }

                if (allRows.length > 0) {
                    setMonitoringRows(allRows);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(allRows));
                    if (!selectedService) setSelectedService(allRows[0]?.service || "");
                } else {
                    // Try Local Cache
                    const storedRows = localStorage.getItem(STORAGE_KEY);
                    if (storedRows) {
                        const parsed = JSON.parse(storedRows);
                        setMonitoringRows(parsed);
                        if (!selectedService) setSelectedService(parsed[0]?.service || "");
                    }
                }

                // 3. Status Date
                const { data: config } = await supabase
                    .from('monitoring_rows')
                    .select('daily_data')
                    .eq('id', '_CONFIG_')
                    .single();
                
                if (config?.daily_data?.status_date) {
                    setStatusDate(config.daily_data.status_date);
                }

            } catch (error) {
                console.error("Error loading monitoring data:", error);
                showToast("Erro ao carregar dados do servidor.", "error");
            } finally {
                setIsLoadingData(false);
            }
        };

        loadData();
    }, []);

    // Filter Logic
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

    // Calendar logic
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        monitoringRows.forEach(r => {
            Object.keys(r.daily_data).forEach(dateStr => {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    months.add(`${parts[0]}-${parts[1]}`);
                }
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
            sum += row.daily_data[d]?.[type] || 0;
        });
        return sum;
    };

    const getGrandTotal = (row: MonitoringRow, type: 'prev' | 'real') => {
        let sum = 0;
        Object.values(row.daily_data).forEach(vals => {
            sum += vals[type] || 0;
        });
        return sum;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save modified rows to Supabase
            // Note: Currently we save the entire state. For better performance we could track dirty rows.
            const { error } = await supabase
                .from('monitoring_rows')
                .upsert(monitoringRows, { onConflict: 'id' });

            if (error) throw error;

            // Save status date
            await supabase
                .from('monitoring_rows')
                .upsert({ id: '_CONFIG_', daily_data: { status_date: statusDate } });

            showToast("Alterações salvas com sucesso!", "success");
            localStorage.setItem(STORAGE_KEY, JSON.stringify(monitoringRows));
        } catch (error) {
            console.error("Save error:", error);
            showToast("Erro ao salvar alterações.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCellChange = (rowId: string, dateKey: string, type: 'prev' | 'real', value: string) => {
        const numValue = Number(value.replace(',', '.'));
        if (isNaN(numValue) && value !== "") return;

        setMonitoringRows(prev => prev.map(r => {
            if (r.id === rowId) {
                const newData = { ...r.daily_data };
                if (!newData[dateKey]) newData[dateKey] = { prev: 0, real: 0 };
                newData[dateKey] = { ...newData[dateKey], [type]: numValue || 0 };
                return { ...r, daily_data: newData };
            }
            return r;
        }));
    };

    if (isLoadingData) {
        return (
            <div className="flex bg-[#060a12] h-screen items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                    <span className="text-brand-accent font-black tracking-widest uppercase">Carregando Planilha...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden text-gray-100 font-sans">
            <Sidebar user={user!} activeScreen="monitoringControl" {...({
                onNavigateToDashboard, onNavigateToReports, onNavigateToBaseline,
                onNavigateToCurrentSchedule, onNavigateToAnalysis, onNavigateToLean,
                onNavigateToLeanConstruction, onNavigateToMonitoringControl,
                onNavigateToWarRoom, onNavigateToPodcast, onNavigateToCost,
                onNavigateToHome, onUpgradeClick, onNavigateToOrgChart,
                onNavigateToOrgSummary, onNavigateToVisualControl, 
                onNavigateToCheckoutSummary, onNavigateToTeams, onNavigateToSystem, onAddTask
            } as any)} />

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <Header title="Monitoramento e Controle" user={user!} onLogout={signOut} />
                
                <div className="flex-1 flex flex-col overflow-hidden p-4 lg:p-6 animate-slide-up">
                    <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Monitoramento e Controle</h1>
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mt-1">
                                <p className="text-brand-med-gray text-sm">Base de Dados Independente - OAEs & Serviços</p>
                                <div className="flex items-center gap-2 bg-brand-dark/50 px-2 py-1 rounded-md border border-white/5">
                                    <span className="text-[10px] text-brand-accent font-bold uppercase tracking-wider">Status:</span>
                                    <input 
                                        type="text"
                                        value={statusDate}
                                        onChange={(e) => setStatusDate(e.target.value)}
                                        className="bg-transparent border-none text-[11px] text-white font-bold focus:ring-0 w-24 p-0"
                                        placeholder="dd/mm/aaaa"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                     <Search size={16} />
                                </span>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por OAE, Apoio..." 
                                    className="bg-brand-dark/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-accent transition-all w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                             </div>

                             <div className="flex items-center gap-3">
                                <button 
                                    onClick={onNavigateToMonitoringDashboard}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/10 transition-all font-black text-xs uppercase tracking-tighter"
                                >
                                    <LayoutDashboard size={14} />
                                    Dashboard Analítico
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-xs uppercase tracking-tighter shadow-lg ${
                                        isSaving 
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-brand-accent to-orange-500 hover:from-brand-accent/90 hover:to-orange-500/90 text-white shadow-brand-accent/20 active:scale-95'
                                    }`}
                                >
                                    {isSaving ? (
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Save size={14} />
                                            Salvar Alterações
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* TABS (SERVICES) */}
                    <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-thin">
                        {services.map(s => (
                            <button
                                key={s}
                                onClick={() => setSelectedService(s)}
                                className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-bold transition-all ${
                                    selectedService === s 
                                    ? 'bg-brand-accent text-white shadow-[0_0_15px_rgba(255,107,0,0.4)]' 
                                    : 'bg-brand-dark/40 text-brand-med-gray hover:bg-brand-dark hover:text-white border border-white/5'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {filteredRows.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center bg-brand-dark/20 rounded-2xl border border-white/5 border-dashed">
                             <div className="p-4 bg-white/5 rounded-full mb-4">
                                <Search size={32} className="text-gray-600" />
                             </div>
                             <p className="text-brand-med-gray font-bold italic">Nenhum registro encontrado para "{searchTerm}" em {selectedService}.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-hidden bg-brand-dark/30 rounded-2xl border border-white/5 shadow-2xl flex flex-col">
                            <div className="overflow-auto custom-scrollbar flex-1">
                                <table className="w-full border-collapse text-left text-[11px]">
                                    <thead className="sticky top-0 z-20 bg-[#0a0f18] text-gray-500 font-black uppercase tracking-tighter shadow-xl">
                                        <tr>
                                            <th className="p-3 border-b border-white/10 w-[120px] sticky left-0 z-30 bg-[#0a0f18]">OAE</th>
                                            <th className="p-3 border-b border-white/10 w-[80px] sticky left-[120px] z-30 bg-[#0a0f18]">Apoio</th>
                                            <th className="p-3 border-b border-white/10 w-[100px] sticky left-[200px] z-30 bg-[#0a0f18]">Resp.</th>
                                            <th className="p-3 border-b border-white/10 w-[40px] text-center">Info</th>
                                            <th className="p-3 border-b border-white/10 w-[60px] text-center bg-brand-accent/5">Total</th>
                                            
                                            {availableMonths.map(m => {
                                                const isExpanded = expandedMonths.has(m);
                                                const days = getMonthDays(m);
                                                return (
                                                    <th 
                                                        key={m} 
                                                        onClick={() => {
                                                            const newSet = new Set(expandedMonths);
                                                            if (newSet.has(m)) newSet.delete(m);
                                                            else newSet.add(m);
                                                            setExpandedMonths(newSet);
                                                        }}
                                                        className={`p-3 border-b border-l border-white/10 cursor-pointer hover:bg-white/5 transition-all text-center ${isExpanded ? 'min-w-[1000px]' : 'min-w-[80px]'}`}
                                                    >
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Calendar size={12} className={isExpanded ? 'text-brand-accent' : ''} />
                                                            <span>{new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1).toLocaleString('pt-BR', {month: 'short', year: '2-digit'}).toUpperCase()}</span>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="grid grid-cols-[80px_repeat(auto-fill,30px)] mt-2 border-t border-white/5 pt-2 font-medium">
                                                                <div className="border-r border-white/5 text-[9px]">RESUMO</div>
                                                                {days.map(d => (
                                                                    <div key={d} className="border-r border-white/5">{d.split('-')[2]}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 font-medium">
                                        {filteredRows.map(row => (
                                            <React.Fragment key={row.id}>
                                                {/* ROW PREV */}
                                                <tr className="bg-[#0c121d] hover:bg-white/5 transition-colors group">
                                                    <td rowSpan={2} className="p-2 border border-white/5 text-white font-bold sticky left-0 z-10 bg-[#0c121d] group-hover:bg-[#121824]">{row.oae}</td>
                                                    <td rowSpan={2} className="p-2 border border-white/5 text-gray-400 sticky left-[120px] z-10 bg-[#0c121d] group-hover:bg-[#121824]">{row.apoio}</td>
                                                    <td rowSpan={2} className="p-2 border border-white/5 text-gray-500 text-[9px] truncate sticky left-[200px] z-10 bg-[#0c121d] group-hover:bg-[#121824]">{row.responsible}</td>
                                                    <td className="p-1 border border-white/5 text-center text-[9px] font-black text-gray-600 bg-black/20">PREV</td>
                                                    <td className="p-2 border border-white/5 text-center font-bold text-gray-400 bg-brand-dark/20">{getGrandTotal(row, 'prev')}</td>
                                                    
                                                    {availableMonths.map(m => {
                                                        const isExpanded = expandedMonths.has(m);
                                                        const days = getMonthDays(m);
                                                        const monthTotal = getMonthTotal(row, m, 'prev');
                                                        return isExpanded ? (
                                                            <React.Fragment key={`prev-${m}`}>
                                                                <td className="p-1 border border-white/5 text-center bg-brand-accent/5 text-brand-accent/60 font-black">{monthTotal}</td>
                                                                {days.map(d => (
                                                                    <td key={d} className="p-0 border border-white/5 bg-[#080d15] w-[30px]">
                                                                        <input 
                                                                            type="text"
                                                                            className="w-full h-8 text-center bg-transparent border-none outline-none text-gray-500 focus:bg-white/5 focus:text-white"
                                                                            value={row.daily_data[d]?.prev || ''}
                                                                            onChange={(e) => handleCellChange(row.id, d, 'prev', e.target.value)}
                                                                        />
                                                                    </td>
                                                                ))}
                                                            </React.Fragment>
                                                        ) : (
                                                            <td key={`prev-${m}`} className="p-1 border border-white/5 text-center text-gray-600 bg-[#0a0f18]">{monthTotal}</td>
                                                        );
                                                    })}
                                                </tr>
                                                
                                                {/* ROW REAL */}
                                                <tr className="bg-[#121a28] hover:bg-white/5 transition-colors group">
                                                    <td className="p-1 border border-white/5 text-center text-[9px] font-black text-brand-accent bg-black/20">REAL</td>
                                                    <td className="p-2 border border-white/5 text-center font-black text-brand-accent bg-brand-accent/5">{getGrandTotal(row, 'real')}</td>
                                                    
                                                    {availableMonths.map(m => {
                                                        const isExpanded = expandedMonths.has(m);
                                                        const days = getMonthDays(m);
                                                        const monthTotal = getMonthTotal(row, m, 'real');
                                                        return isExpanded ? (
                                                            <React.Fragment key={`real-${m}`}>
                                                                <td className="p-1 border border-white/5 text-center bg-brand-accent/10 text-brand-accent font-black">{monthTotal}</td>
                                                                {days.map(d => (
                                                                    <td key={d} className="p-0 border border-white/5 bg-[#121a28] w-[30px]">
                                                                        <input 
                                                                            type="text"
                                                                            className="w-full h-8 text-center bg-transparent border-none outline-none text-white font-bold focus:bg-brand-accent/20 focus:text-brand-accent"
                                                                            value={row.daily_data[d]?.real || ''}
                                                                            onChange={(e) => handleCellChange(row.id, d, 'real', e.target.value)}
                                                                        />
                                                                    </td>
                                                                ))}
                                                            </React.Fragment>
                                                        ) : (
                                                            <td key={`real-${m}`} className="p-1 border border-white/5 text-center text-brand-accent/60 bg-[#121a28] font-bold">{monthTotal}</td>
                                                        );
                                                    })}
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                        
                                        {/* Footer Totals Row */}
                                        <tr className="bg-brand-dark/80 font-black text-brand-accent border-t-2 border-brand-accent/30 sticky bottom-0 z-10">
                                            <td colSpan={3} className="px-3 py-3 text-right uppercase tracking-tighter text-xs">Total do Serviço</td>
                                            <td className="px-3 py-3 border-x border-white/5 text-[10px]">
                                                <div className="flex flex-col gap-1.5 font-bold">
                                                    <span className="text-gray-400">PREV</span>
                                                    <span className="text-brand-accent">REAL</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 bg-brand-accent/10 border-r border-white/10 text-center">
                                                <div className="flex flex-col gap-1.5 font-bold">
                                                    <span>{filteredRows.reduce((acc, r) => acc + getGrandTotal(r, 'prev'), 0).toLocaleString()}</span>
                                                    <span>{filteredRows.reduce((acc, r) => acc + getGrandTotal(r, 'real'), 0).toLocaleString()}</span>
                                                </div>
                                            </td>

                                            {availableMonths.map(m => (
                                                <React.Fragment key={`total-${m}`}>
                                                    <td className="px-3 py-3 bg-brand-dark border-r border-white/5 text-center min-w-[70px]">
                                                        <div className="flex flex-col gap-1.5 font-bold">
                                                            <span className="text-gray-400">{filteredRows.reduce((acc, r) => acc + getMonthTotal(r, m, 'prev'), 0).toLocaleString()}</span>
                                                            <span className="text-brand-accent">{filteredRows.reduce((acc, r) => acc + getMonthTotal(r, m, 'real'), 0).toLocaleString()}</span>
                                                        </div>
                                                    </td>

                                                    {expandedMonths.has(m) && getMonthDays(m).map(dayKey => {
                                                        return (
                                                            <td key={`total-day-${dayKey}`} className="px-2 py-3 border-r border-white/5 text-center min-w-[50px] bg-brand-dark/40">
                                                                <div className="flex flex-col gap-1.5 font-bold text-[10px]">
                                                                    <span className="text-gray-500">{filteredRows.reduce((acc, r) => acc + (Number(r.daily_data[dayKey]?.prev) || 0), 0)}</span>
                                                                    <span className="text-brand-accent/80">{filteredRows.reduce((acc, r) => acc + (Number(r.daily_data[dayKey]?.real) || 0), 0)}</span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default MonitoringControlPage;
