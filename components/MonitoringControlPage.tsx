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

    useEffect(() => {
        const load = async () => {
            setIsLoadingData(true);
            try {
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
                    if (error) hasMore = false;
                }

                if (allRows.length > 0) {
                    setMonitoringRows(allRows);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(allRows));
                    if (!selectedService) setSelectedService(allRows[0]?.service || "");
                } else {
                    const cached = localStorage.getItem(STORAGE_KEY);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        setMonitoringRows(parsed);
                        if (!selectedService) setSelectedService(parsed[0]?.service || "");
                    }
                }
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
        days.forEach(d => sum += row.daily_data?.[d]?.[type] || 0);
        return sum;
    };

    const getGrandTotal = (row: MonitoringRow, type: 'prev' | 'real') => {
        let sum = 0;
        Object.values(row.daily_data || {}).forEach(vals => sum += (vals as any)[type] || 0);
        return sum;
    };

    const handleCellChange = (rowId: string, dateKey: string, type: 'prev' | 'real', value: string) => {
        const val = value.replace(',', '.');
        const num = parseFloat(val);
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

    const toggleMonth = (m: string) => {
        const n = new Set(expandedMonths);
        if (n.has(m)) n.delete(m); else n.add(m);
        setExpandedMonths(n);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await supabase.from('monitoring_rows').upsert(monitoringRows, { onConflict: 'id' });
            await supabase.from('monitoring_rows').upsert({ id: '_CONFIG_', daily_data: { status_date: statusDate } });
            showToast("Alterações salvas!", "success");
            localStorage.setItem(STORAGE_KEY, JSON.stringify(monitoringRows));
        } catch (e) {
            showToast("Erro ao salvar.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingData) return <div className="flex bg-[#060a12] h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-accent"></div></div>;

    const services = Array.from(new Set(monitoringRows.map(r => r.service))).sort();

    // DEFINIÇÃO DE LARGURAS PARA STICKY (OAE, APOIO, RESP, INFO, TOTAL)
    const W_OAE = 110;
    const W_APOIO = 100;
    const W_RESP = 130;
    const W_INFO = 45;
    const W_TOTAL = 75;

    // DEFINIÇÃO DE CORES SÓLIDAS PARA ELIMINAR TRANSPARÊNCIA
    const BG_STICKY_HDR = "#0a0f18";
    const BG_STICKY_PREV = "#0c121d";
    const BG_STICKY_REAL = "#111827";

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden text-gray-100">
            <Sidebar user={user!} activeScreen="monitoringControl" {...(props as any)} />

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <Header title="Monitoramento e Controle" user={user!} onLogout={signOut} />
                
                <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
                    <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Monitoramento e Controle</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-brand-accent font-bold uppercase select-none">Status:</span>
                                <input type="text" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} className="bg-brand-dark/50 border border-white/5 rounded px-2 py-0.5 text-xs font-bold text-white w-28 outline-none focus:border-brand-accent/40" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand-accent transition-colors" />
                                <input type="text" placeholder="Filtrar planilha..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-brand-dark/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm w-64 outline-none focus:border-brand-accent transition-all" />
                            </div>
                            <button onClick={onNavigateToMonitoringDashboard} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs uppercase shadow-xl active:scale-95 transition-all"><LayoutDashboard size={14} /> Painel Analítico</button>
                            <button onClick={handleSave} disabled={isSaving} className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-xs uppercase shadow-xl transition-all ${isSaving ? 'bg-gray-800' : 'bg-brand-accent hover:bg-brand-accent/90 active:scale-95'}`}>
                                {isSaving ? '...' : <Save size={14} />}{isSaving ? 'Salvando' : 'Salvar Tudo'}
                            </button>
                        </div>
                    </header>

                    <div className="flex overflow-x-auto gap-2 mb-4 scrollbar-hide py-1">
                        {services.map(s => (
                            <button key={s} onClick={() => setSelectedService(s)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${selectedService === s ? 'bg-brand-accent text-white shadow-xl shadow-brand-accent/20 border border-brand-accent' : 'bg-brand-dark/40 text-gray-500 border border-white/5 hover:border-white/20'}`}>{s}</button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-hidden bg-[#0a0f18] rounded-2xl border border-white/5 flex flex-col shadow-2xl relative">
                        <div className="overflow-auto custom-scrollbar flex-1">
                            <table className="w-full border-separate border-spacing-0 text-[10px] min-w-max">
                                <thead className="sticky top-0 z-50">
                                    <tr className="text-gray-500 font-bold uppercase transition-all">
                                        <th style={{width: W_OAE, left: 0}} className={`sticky z-50 p-3 border-b border-r border-white/20 text-left`} rowSpan={2} bgcolor={BG_STICKY_HDR}>OAE</th>
                                        <th style={{width: W_APOIO, left: W_OAE}} className={`sticky z-50 p-3 border-b border-r border-white/20 text-left`} rowSpan={2} bgcolor={BG_STICKY_HDR}>Apoio</th>
                                        <th style={{width: W_RESP, left: W_OAE + W_APOIO}} className={`sticky z-50 p-3 border-b border-r border-white/20 text-left`} rowSpan={2} bgcolor={BG_STICKY_HDR}>Resp.</th>
                                        <th style={{width: W_INFO, left: W_OAE + W_APOIO + W_RESP}} className={`sticky z-50 p-3 border-b border-r border-white/20 text-center`} rowSpan={2} bgcolor={BG_STICKY_HDR}>Info</th>
                                        <th style={{width: W_TOTAL, left: W_OAE + W_APOIO + W_RESP + W_INFO}} className={`sticky z-50 p-3 border-b border-r border-brand-accent/50 text-center font-black text-brand-accent`} rowSpan={2} bgcolor={BG_STICKY_HDR}>Total</th>
                                        
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            const colSpan = exp ? getMonthDays(m).length + 1 : 1;
                                            return <th key={m} colSpan={colSpan} onClick={() => toggleMonth(m)} className="p-2 border-b border-r border-white/10 text-center cursor-pointer hover:bg-white/5 transition-all bg-[#0a0f18]">
                                                <div className="flex items-center justify-center gap-1 uppercase select-none tracking-tight">
                                                    {exp ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                                    {new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1])-1).toLocaleString('pt-BR', {month: 'short', year: '2-digit'})}
                                                </div>
                                            </th>;
                                        })}
                                    </tr>
                                    <tr className="text-[8px] text-gray-600 bg-[#0a0f18]">
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            if (!exp) return <th key={`sub-${m}`} className="p-1 border-b border-r border-white/10 text-center">RESUMO</th>;
                                            return <React.Fragment key={`sub-exp-${m}`}>
                                                <th className="p-1 border-b border-r border-cyan-500/30 text-center bg-cyan-900/20 text-cyan-400">RESUMO</th>
                                                {getMonthDays(m).map(d => <th key={d} className="p-1 border-b border-r border-white/5 text-center font-medium w-[28px]">{d.split('-')[2]}</th>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-white/5">
                                    {filteredRows.map(row => (
                                        <React.Fragment key={row.id}>
                                            <tr className="hover:bg-[#141b26] group transition-colors">
                                                <td style={{left: 0}} rowSpan={2} className={`sticky z-30 p-2 border-r border-white/10 text-white font-bold truncate`} bgcolor={BG_STICKY_PREV}>{row.oae}</td>
                                                <td style={{left: W_OAE}} rowSpan={2} className={`sticky z-30 p-2 border-r border-white/10 text-gray-400 truncate`} bgcolor={BG_STICKY_PREV}>{row.apoio}</td>
                                                <td style={{left: W_OAE + W_APOIO}} rowSpan={2} className={`sticky z-30 p-2 border-r border-white/10 text-[10px] text-gray-300 font-semibold truncate transition-all`} bgcolor={BG_STICKY_PREV}>{row.responsible}</td>
                                                
                                                <td style={{left: W_OAE + W_APOIO + W_RESP}} className={`sticky z-30 p-1 border-r border-white/10 text-center text-[8px] font-black text-gray-500 uppercase`} bgcolor={BG_STICKY_PREV}>Prev</td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO}} className={`sticky z-30 p-1 border-r border-white/20 text-center font-bold text-gray-400`} bgcolor={BG_STICKY_PREV}>{getGrandTotal(row, 'prev')}</td>
                                                
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'prev');
                                                    if (!exp) return <td key={`p-${m}`} className="p-1 border-r border-white/5 text-center text-gray-600 bg-black/10 text-[9px] font-black">{total}</td>;
                                                    return <React.Fragment key={`p-exp-${m}`}>
                                                        <td className="p-1 border-r border-white/5 text-center bg-cyan-900/10 text-cyan-500/60 font-black">{total}</td>
                                                        {getMonthDays(m).map(d => (
                                                            <td key={d} className="p-0 border-r border-white/5 w-[28px] bg-black/5">
                                                                <input type="text" value={row.daily_data?.[d]?.prev || ''} onChange={(e) => handleCellChange(row.id, d, 'prev', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent border-none outline-none text-gray-500 text-[10px] focus:bg-white/5 focus:text-white" />
                                                            </td>
                                                        ))}
                                                    </React.Fragment>;
                                                })}
                                            </tr>
                                            <tr className="hover:bg-[#182133] group transition-colors">
                                                <td style={{left: W_OAE + W_APOIO + W_RESP}} className={`sticky z-30 p-1 border-r border-white/10 text-center text-[8px] font-black text-brand-accent uppercase`} bgcolor={BG_STICKY_REAL}>Real</td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO}} className={`sticky z-30 p-1 border-r border-white/30 text-center font-black text-brand-accent`} bgcolor={BG_STICKY_REAL}>{getGrandTotal(row, 'real')}</td>
                                                
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'real');
                                                    if (!exp) return <td key={`r-${m}`} className="p-1 border-r border-white/5 text-center text-brand-accent/60 bg-brand-accent/10 font-bold text-[9px]">{total}</td>;
                                                    return <React.Fragment key={`r-exp-${m}`}>
                                                        <td className="p-1 border-r border-white/5 text-center bg-brand-accent/20 text-brand-accent font-black">{total}</td>
                                                        {getMonthDays(m).map(d => (
                                                            <td key={d} className="p-0 border-r border-white/5 w-[28px] bg-brand-accent/5">
                                                                <input type="text" value={row.daily_data?.[d]?.real || ''} onChange={(e) => handleCellChange(row.id, d, 'real', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent border-none outline-none text-brand-accent font-black text-[10px] focus:bg-brand-accent/20" />
                                                            </td>
                                                        ))}
                                                    </React.Fragment>;
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
