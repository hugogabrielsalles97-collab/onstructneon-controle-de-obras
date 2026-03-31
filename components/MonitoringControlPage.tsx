import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../context/DataProvider';
import { supabase } from '../supabaseClient';

interface MonitoringRow {
    id: string;
    service: string;
    oae: string;
    apoio: string;
    responsible: string;
    type_info?: string;
    daily_data: {
        [dateKey: string]: {
            prev: number;
            real: number;
        }
    }
}

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
    showToast
}) => {
    const { currentUser: user, signOut } = useData();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [monitoringRows, setMonitoringRows] = useState<MonitoringRow[]>([]);
    
    // UI States
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [selectedService, setSelectedService] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const services = useMemo(() => {
        const s = new Set<string>();
        monitoringRows.forEach(r => s.add(r.service));
        return Array.from(s).sort();
    }, [monitoringRows]);

    useEffect(() => {
        if (!selectedService && services.length > 0) {
            setSelectedService(services[0]);
        }
    }, [services, selectedService]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                // 1. Try Supabase
                const { data: dbData, error } = await supabase
                    .from('monitoring_rows')
                    .select('*')
                    .order('oae', { ascending: true });

                if (dbData && dbData.length > 0) {
                    setMonitoringRows(dbData);
                } else {
                    // 2. Fallback to Local Seed
                    const res = await fetch('/monitoring_seed.json');
                    if (res.ok) {
                        const seed = await res.json();
                        // monitoring_seed.json has { rows, dailyData }
                        // Convert to MonitoringRow[]
                        const merged = seed.rows.map((r: any) => ({
                            ...r,
                            daily_data: seed.dailyData[r.id] || {}
                        }));
                        setMonitoringRows(merged);
                    }
                }
            } catch (err) {
                console.error("Error loading monitoring data", err);
                showToast("Erro ao carregar dados de monitoramento.", "error");
            } finally {
                setIsLoadingData(false);
            }
        };
        loadData();
    }, []);

    const toggleMonth = (monthKey: string) => {
        const newSet = new Set(expandedMonths);
        if (newSet.has(monthKey)) newSet.delete(monthKey);
        else newSet.add(monthKey);
        setExpandedMonths(newSet);
    };

    const handleCellChange = async (rowId: string, dateKey: string, type: 'prev' | 'real', value: string) => {
        const numValue = value === '' ? 0 : parseFloat(value.replace(',', '.'));
        if (isNaN(numValue)) return;

        const updatedRows = monitoringRows.map(r => {
            if (r.id === rowId) {
                const newData = { ...r.daily_data };
                if (!newData[dateKey]) newData[dateKey] = { prev: 0, real: 0 };
                newData[dateKey] = { ...newData[dateKey], [type]: numValue };
                
                // Update in DB (debounce or background)
                const updateDb = async () => {
                    await supabase
                        .from('monitoring_rows')
                        .update({ daily_data: newData })
                        .eq('id', rowId);
                };
                updateDb();

                return { ...r, daily_data: newData };
            }
            return r;
        });
        setMonitoringRows(updatedRows);
    };

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    // Calculate Month Columns
    const availableMonths = useMemo(() => {
        const monthSet = new Set<string>();
        monitoringRows.forEach(r => {
            Object.keys(r.daily_data).forEach(dk => {
                monthSet.add(dk.substring(0, 7)); // YYYY-MM
            });
        });
        return Array.from(monthSet).sort();
    }, [monitoringRows]);

    const filteredRows = useMemo(() => {
        return monitoringRows.filter(r => 
            r.service === selectedService && 
            (r.oae.toLowerCase().includes(searchTerm.toLowerCase()) || 
             r.apoio.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (r.responsible || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [monitoringRows, selectedService, searchTerm]);

    const getMonthTotal = (row: MonitoringRow, monthKey: string, type: 'prev' | 'real') => {
        let sum = 0;
        Object.entries(row.daily_data).forEach(([date, vals]) => {
            if (date.startsWith(monthKey)) {
                sum += vals[type] || 0;
            }
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

    const getMonthDays = (monthKey: string) => {
        const [year, month] = monthKey.split('-').map(Number);
        const days = new Date(year, month, 0).getDate();
        return Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            return `${monthKey}-${String(d).padStart(2, '0')}`;
        });
    };

    const formatMonthName = (monthKey: string) => {
        const [y, m] = monthKey.split('-');
        const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return `${names[parseInt(m) - 1]} ${y}`;
    };

    if (!user) return null;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="monitoringControl"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToMonitoringControl={onNavigateToMonitoringControl}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToPodcast={onNavigateToPodcast}
                onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToOrgSummary={onNavigateToOrgSummary}
                onNavigateToVisualControl={onNavigateToVisualControl}
                onNavigateToTeams={onNavigateToTeams}
                onNavigateToSystem={onNavigateToSystem}
                onUpgradeClick={onUpgradeClick}
                onAddTask={onAddTask}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    user={user}
                    onLogout={handleLogout}
                    onNavigateToHome={onNavigateToHome}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToReports={onNavigateToReports}
                    onNavigateToBaseline={onNavigateToBaseline}
                    onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={onNavigateToAnalysis}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToMonitoringControl={onNavigateToMonitoringControl}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={onNavigateToOrgChart}
                    onNavigateToOrgSummary={onNavigateToOrgSummary}
                    onNavigateToVisualControl={onNavigateToVisualControl}
                    onNavigateToTeams={onNavigateToTeams}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="monitoringControl"
                />

                <div className="flex-1 flex flex-col overflow-hidden p-4 lg:p-6 animate-slide-up">
                    <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Monitoramento e Controle</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-brand-med-gray text-sm">Base de Dados Independente - OAEs & Serviços</p>
                                <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-brand-accent/20">
                                    Status: 30/03/2026
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                </span>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por OAE, Apoio..." 
                                    className="bg-brand-dark/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-accent transition-all w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
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

                    {isLoadingData ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-brand-med-gray">
                            <div className="w-12 h-12 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin mb-4"></div>
                            <p className="font-bold tracking-widest text-xs uppercase">Carregando base de monitoramento...</p>
                        </div>
                    ) : (
                        <div className="flex-1 bg-[#0a0f18] border border-white/5 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-auto custom-scrollbar relative">
                                <table className="w-full text-left border-collapse min-w-max text-[10px]">
                                    <thead className="sticky top-0 z-20 bg-[#121824] shadow-md border-b border-white/10 text-white uppercase tracking-tighter font-black">
                                        <tr className="h-10">
                                            <th className="p-2 border border-white/5 w-24 sticky left-0 z-30 bg-[#121824]">OAE</th>
                                            <th className="p-2 border border-white/5 w-24 sticky left-24 z-30 bg-[#121824]">APOIO</th>
                                            <th className="p-2 border border-white/5 w-32 sticky left-48 z-30 bg-[#121824]">ENGENHEIRO</th>
                                            <th className="p-2 border border-white/5 w-16 text-center text-brand-med-gray">P/R</th>
                                            <th className="p-2 border border-white/5 w-24 text-center bg-brand-accent/10 text-brand-accent">TOTAL GERAL</th>
                                            
                                            {availableMonths.map(m => {
                                                const isExpanded = expandedMonths.has(m);
                                                const days = getMonthDays(m);
                                                return (
                                                    <th 
                                                        key={m} 
                                                        colSpan={isExpanded ? days.length + 1 : 1}
                                                        className={`p-1 border border-white/5 text-center transition-all ${isExpanded ? 'bg-brand-accent/5' : ''}`}
                                                    >
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span>{formatMonthName(m)}</span>
                                                            <button 
                                                                onClick={() => toggleMonth(m)}
                                                                className="hover:text-brand-accent transition-colors"
                                                            >
                                                                {isExpanded ? (
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
                                                                ) : (
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="grid grid-flow-col auto-cols-[30px] border-t border-white/5 mt-1 font-medium text-[9px] text-gray-500">
                                                                <div className="border-r border-white/5 bg-brand-accent/10 text-brand-accent font-black">TOTAL</div>
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
                                        {filteredRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={100} className="py-20 text-center text-brand-med-gray italic">
                                                    Nenhum registro encontrado para "{searchTerm}" em {selectedService}.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRows.map(row => (
                                                <React.Fragment key={row.id}>
                                                    {/* ROW PREV */}
                                                    <tr className="bg-[#0c121d] hover:bg-white/5 transition-colors group">
                                                        <td rowSpan={2} className="p-2 border border-white/5 text-white font-bold sticky left-0 z-10 bg-[#0c121d] group-hover:bg-[#121824]">{row.oae}</td>
                                                        <td rowSpan={2} className="p-2 border border-white/5 text-gray-400 sticky left-24 z-10 bg-[#0c121d] group-hover:bg-[#121824]">{row.apoio}</td>
                                                        <td rowSpan={2} className="p-2 border border-white/5 text-gray-500 text-[9px] truncate sticky left-48 z-10 bg-[#0c121d] group-hover:bg-[#121824]">{row.responsible}</td>
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
                                            ))
                                        )}
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
