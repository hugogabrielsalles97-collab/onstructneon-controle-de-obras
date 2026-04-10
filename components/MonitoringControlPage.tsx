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
                    // Normalize "Bruno" to "Bruno Bastos"
                    const mapped = allRows.map(r => ({
                        ...r,
                        responsible: (r.responsible === 'Bruno' || r.responsible === 'Bruno ') ? 'Bruno Bastos' : r.responsible
                    }));
                    setMonitoringRows(mapped);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
                    if (!selectedService) setSelectedService(mapped[0]?.service || "");
                } else {
                    const cached = localStorage.getItem(STORAGE_KEY);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        setMonitoringRows(parsed);
                        if (!selectedService) setSelectedService(parsed[0]?.service || "");
                    }
                }
                const { data: config, error: configError } = await supabase.from('monitoring_rows').select('daily_data').eq('id', '_CONFIG_').maybeSingle();
                if (configError) throw configError;
                if (config?.daily_data?.status_date) {
                    setStatusDate(config.daily_data.status_date);
                    localStorage.setItem(`@elos_monitoring_status_date`, config.daily_data.status_date);
                } else {
                    const cachedDate = localStorage.getItem(`@elos_monitoring_status_date`);
                    if (cachedDate) setStatusDate(cachedDate);
                }
            } catch (e: any) {
                console.error("Erro ao carregar dados:", e);
                const cachedDate = localStorage.getItem(`@elos_monitoring_status_date`);
                if (cachedDate) setStatusDate(cachedDate);
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
            const { error: errorRows } = await supabase.from('monitoring_rows').upsert(monitoringRows, { onConflict: 'id' });
            if (errorRows) throw errorRows;

            const { error: errorConfig } = await supabase.from('monitoring_rows').upsert({ 
                id: '_CONFIG_', 
                service: '_CONFIG_',
                oae: '_CONFIG_',
                apoio: '_CONFIG_',
                responsible: '_CONFIG_',
                daily_data: { status_date: statusDate } 
            }, { onConflict: 'id' });
            
            if (errorConfig) throw errorConfig;

            showToast("Alterações salvas!", "success");
            localStorage.setItem(STORAGE_KEY, JSON.stringify(monitoringRows));
            localStorage.setItem(`@elos_monitoring_status_date`, statusDate);
        } catch (e: any) {
            console.error("Erro ao salvar:", e);
            showToast(`Erro ao salvar: ${e.message || 'Erro desconhecido'}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingData) return <div className="flex bg-[#060a12] h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-accent"></div></div>;

    const serviceOrder = [
        'ESTACA', 'BLOCO', 'PILAR', 'TRAVESSA', 'PILAR PROVISORIO', 
        'LANCAMENTO VIGA', 'TRANSVERSINA', 'LANCAMENTO PRELAJE', 
        'LAJE', 'LAJE ELASTICA', 'LAJE DE APROXIMACAO', 
        'FABRICACAO VIGA', 'FABRICACAO PRELAJE',
        'CORTINA ATIRANTADA', 'SOLO GRAMPEADO', 'CBUQ'
    ];

    const isTrechoService = selectedService === 'CBUQ';
    const isCorteService = selectedService === 'CORTINA ATIRANTADA' || selectedService === 'SOLO GRAMPEADO';
    const col1Label = isTrechoService ? 'Trecho' : (isCorteService ? 'Corte' : 'OAE');
    const col2Label = isCorteService || isTrechoService ? 'FT' : 'Apoio';

    const services = Array.from(new Set(monitoringRows.map(r => r.service)) as Set<string>).sort((a, b) => {
        const idxA = serviceOrder.indexOf(a);
        const idxB = serviceOrder.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    // LARGURAS STICKY
    const W_OAE = 110;
    const W_APOIO = 80;
    const W_RESP = 140;
    const W_INFO = 45;
    const W_TOTAL = 75;

    // CORES SOLIDAS PARA BLOQUEAR TRANSPARÊNCIA
    const BG_STICKY_HDR = "#0a0f18";
    const BG_STICKY_PREV = "#0d1421"; 
    const BG_STICKY_REAL = "#161d2b"; 
    const BG_TOTAL_PANEL = "#1a1f2c"; 

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden text-gray-100">
            <Sidebar user={user!} activeScreen="monitoringControl" {...(props as any)} />

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <Header 
                    title="Monitoramento e Controle" 
                    user={user!} 
                    onLogout={signOut} 
                    activeScreen="monitoringControl"
                    onNavigateToHome={props.onNavigateToHome}
                    onNavigateToDashboard={props.onNavigateToDashboard}
                    onNavigateToReports={props.onNavigateToReports}
                    onNavigateToBaseline={props.onNavigateToBaseline}
                    onNavigateToCurrentSchedule={props.onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={props.onNavigateToAnalysis}
                    onNavigateToLean={props.onNavigateToLean}
                    onNavigateToLeanConstruction={props.onNavigateToLeanConstruction}
                    onNavigateToMonitoringControl={props.onNavigateToMonitoringControl}
                    onNavigateToPodcast={props.onNavigateToPodcast}
                    onNavigateToWarRoom={props.onNavigateToWarRoom}
                    onNavigateToCost={props.onNavigateToCost}
                    onNavigateToCheckoutSummary={props.onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={props.onNavigateToOrgChart}
                    onNavigateToOrgSummary={props.onNavigateToOrgSummary}
                    onNavigateToTeams={props.onNavigateToTeams}
                    onNavigateToVisualControl={props.onNavigateToVisualControl}
                    onUpgradeClick={props.onUpgradeClick}
                />
                
                <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
                    <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Monitoramento e Controle</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-brand-accent font-bold uppercase transition-all">Data Status:</span>
                                <input type="text" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} className="bg-brand-dark/50 border border-white/5 rounded px-2 py-0.5 text-xs font-bold text-white w-28 outline-none focus:border-brand-accent/40" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-brand-accent" />
                                <input type="text" placeholder="Filtrar planilha..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-brand-dark/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm w-64 outline-none focus:border-brand-accent transition-all" />
                            </div>
                            <button onClick={onNavigateToMonitoringDashboard} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs uppercase shadow-xl transition-all active:scale-95"><LayoutDashboard size={14} /> Analítico</button>
                            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-brand-accent hover:bg-brand-accent/90 rounded-xl font-bold text-xs uppercase shadow-xl transition-all active:scale-95">{isSaving ? '...' : 'Salvar Tudo'}</button>
                        </div>
                    </header>

                    <div className="flex overflow-x-auto gap-2 mb-4 scrollbar-hide py-1">
                        {services.map(s => (
                            <button key={s} onClick={() => setSelectedService(s)} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${selectedService === s ? 'bg-brand-accent text-white shadow-xl shadow-brand-accent/20 border border-brand-accent' : 'bg-brand-dark/40 text-gray-500 border border-white/5 hover:border-white/20'}`}>{s}</button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-hidden bg-[#0a0f18] rounded-2xl border border-white/5 flex flex-col shadow-2xl relative">
                        <div className="overflow-auto custom-scrollbar flex-1 relative">
                            <table className="w-full border-separate border-spacing-0 text-[10px] min-w-max">
                                <thead className="sticky top-0 z-[100] bg-[#0a0f18]">
                                    <tr className="text-gray-500 font-extrabold uppercase tracking-widest text-[9px] h-8 bg-[#0a0f18] sticky top-0 z-[150]">
                                        <th style={{width: W_OAE, left: 0}} className="sticky z-50 p-3 border-b border-r border-white/20 text-left bg-[#0a0f18]" rowSpan={2}>{col1Label}</th>
                                        <th style={{width: W_APOIO, left: W_OAE}} className="sticky z-50 p-3 border-b border-r border-white/20 text-left bg-[#0a0f18]" rowSpan={2}>{col2Label}</th>
                                        <th style={{width: W_RESP, left: W_OAE + W_APOIO}} className="sticky z-50 p-3 border-b border-r border-white/20 text-left bg-[#0a0f18]" rowSpan={2}>Engenheiro</th>
                                        <th style={{width: W_INFO, left: W_OAE + W_APOIO + W_RESP}} className="sticky z-50 p-3 border-b border-r border-white/10 text-center bg-[#0a0f18]" rowSpan={2}>Info</th>
                                        <th style={{width: W_TOTAL, left: W_OAE + W_APOIO + W_RESP + W_INFO}} className="sticky z-50 p-3 border-b border-r border-brand-accent/50 text-center font-black text-brand-accent bg-[#0a0f18]" rowSpan={2}>TOTAL</th>
                                        
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            return <th key={m} colSpan={exp ? getMonthDays(m).length + 1 : 1} onClick={() => toggleMonth(m)} className="p-2 border-b border-r border-white/10 text-center cursor-pointer hover:bg-white/5 transition-all bg-[#0a0f18]">
                                                <div className="flex items-center justify-center gap-1 uppercase select-none tracking-tight">
                                                    {exp ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                                    {new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1])-1).toLocaleString('pt-BR', {month: 'short', year: '2-digit'})}
                                                </div>
                                            </th>;
                                        })}
                                    </tr>
                                    <tr className="text-[8px] text-gray-600 h-7 bg-[#0a0f18] sticky top-8 z-[150]">
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            if (!exp) return <th key={`sub-${m}`} className="p-1 border-b border-r border-white/10 text-center bg-[#0a0f18]">RESUMO</th>;
                                            return <React.Fragment key={`sub-exp-${m}`}>
                                                <th className="p-1 border-b border-r border-cyan-500/30 text-center bg-cyan-900/20 text-cyan-400">RESUMO</th>
                                                {getMonthDays(m).map(d => <th key={d} className="p-1 border-b border-r border-white/5 text-center font-medium w-[28px] bg-[#0a0f18]">{d.split('-')[2]}</th>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-white/5">
                                    {/* TOTAL GERAL ROWS (SOLID OPACITY AND HIGH Z-INDEX) */}
                                    <tr className="sticky top-[60px] z-[110] bg-[#1a1f2c] h-8">
                                        <td style={{left: 0, width: W_OAE}} rowSpan={2} className="sticky z-[120] p-2 border-r border-b-2 border-brand-accent/30 text-brand-accent text-center font-black uppercase text-[11px] bg-[#1a1f2c] align-middle">TOTAL</td>
                                        <td style={{left: W_OAE, width: W_APOIO}} rowSpan={2} className="sticky z-[120] p-2 border-r border-b-2 border-brand-accent/30 text-brand-accent text-center font-black uppercase text-[11px] bg-[#1a1f2c] align-middle">GERAL</td>
                                        <td style={{left: W_OAE + W_APOIO, width: W_RESP}} rowSpan={2} className="sticky z-[120] p-2 border-r border-b-2 border-brand-accent/30 bg-[#1a1f2c] align-middle"></td>
                                        
                                        <td style={{left: W_OAE + W_APOIO + W_RESP}} className="sticky z-[120] p-1 border-r border-b border-white/10 text-center text-[9px] font-black text-gray-200 uppercase bg-[#1a1f2c]">PREV</td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO}} className="sticky z-[120] p-1 border-r border-b border-brand-accent/30 text-center text-gray-100 font-black text-[11px] bg-[#1a1f2c]">
                                            {filteredRows.reduce((a, r) => a + getGrandTotal(r, 'prev'), 0).toLocaleString()}
                                        </td>
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            const monthSum = filteredRows.reduce((a, r) => a + getMonthTotal(r, m, 'prev'), 0);
                                            if (!exp) return <td key={`GP-${m}`} className="p-1 border-r border-b border-brand-accent/20 text-center font-black bg-[#1a1f2c] text-gray-300 text-[11px]">{monthSum.toLocaleString()}</td>;
                                            return <React.Fragment key={`GP-exp-${m}`}>
                                                <td className="p-1 border-r border-b border-cyan-500/30 text-center bg-cyan-900/40 text-cyan-400 font-black text-[11px]">{monthSum.toLocaleString()}</td>
                                                {getMonthDays(m).map(d => <td key={`GP-d-${d}`} className="p-1 border-r border-b border-white/10 text-center bg-[#1a1f2c] text-gray-400 font-bold">{filteredRows.reduce((a, r) => a + (r.daily_data?.[d]?.prev || 0), 0)}</td>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>
                                    <tr className="sticky top-[92px] z-[110] bg-[#1a1f2c] h-8">
                                        <td style={{left: W_OAE + W_APOIO + W_RESP}} className="sticky z-[120] p-1 border-r border-b-2 border-brand-accent/30 text-center text-[8px] font-black text-brand-accent uppercase bg-[#1a1f2c]">REAL</td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO}} className="sticky z-[120] p-1 border-r border-b-2 border-brand-accent/30 text-center text-brand-accent font-black text-[11px] bg-[#1a1f2c]">
                                            {filteredRows.reduce((a, r) => a + getGrandTotal(r, 'real'), 0).toLocaleString()}
                                        </td>
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            const monthSum = filteredRows.reduce((a, r) => a + getMonthTotal(r, m, 'real'), 0);
                                            if (!exp) return <td key={`GR-${m}`} className="p-1 border-r border-b-2 border-brand-accent/30 text-center font-black bg-[#1a1f2c] text-brand-accent text-[11px]">{monthSum.toLocaleString()}</td>;
                                            return <React.Fragment key={`GR-exp-${m}`}>
                                                <td className="p-1 border-r border-b-2 border-brand-accent/40 text-center bg-brand-accent/20 text-brand-accent font-black text-[11px]">{monthSum.toLocaleString()}</td>
                                                {getMonthDays(m).map(d => <td key={`GR-d-${d}`} className="p-1 border-r border-b-2 border-white/10 text-center bg-[#1a1f2c] text-brand-accent font-black">{filteredRows.reduce((a, r) => a + (r.daily_data?.[d]?.real || 0), 0)}</td>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>





                                    {/* DATA ROWS WITH ZEBRA STRIPING */}
                                    {filteredRows.map((row, idx) => (
                                        <React.Fragment key={row.id}>
                                            <tr className={`${idx % 2 === 0 ? 'bg-[#0d1421]' : 'bg-[#0a0f18]'} hover:bg-[#1a2b4b] group transition-colors border-b border-white/5`}>
                                                <td style={{left: 0}} rowSpan={2} className={`sticky z-30 p-2 border-r border-b border-white/10 text-white font-bold truncate ${idx % 2 === 0 ? 'bg-[#0d1421]' : 'bg-[#0a0f18]'} group-hover:bg-[#1a2b4b]`}>{row.oae}</td>
                                                <td style={{left: W_OAE}} rowSpan={2} className={`sticky z-30 p-2 border-r border-b border-white/10 text-blue-400 font-black truncate text-center ${idx % 2 === 0 ? 'bg-[#0d1421]' : 'bg-[#0a0f18]'} group-hover:bg-[#1a2b4b]`}>{row.apoio}</td>
                                                <td style={{left: W_OAE + W_APOIO}} rowSpan={2} className={`sticky z-30 p-2 border-r border-b border-white/10 text-[10px] text-gray-300 font-semibold truncate ${idx % 2 === 0 ? 'bg-[#0d1421]' : 'bg-[#0a0f18]'} group-hover:bg-[#1a2b4b]`}>{row.responsible}</td>
                                                
                                                <td style={{left: W_OAE + W_APOIO + W_RESP}} className={`sticky z-30 p-1 border-r border-b border-blue-500/30 text-center text-[8px] font-black text-blue-500 uppercase ${idx % 2 === 0 ? 'bg-[#0d1421]' : 'bg-[#0a0f18]'} group-hover:bg-[#1a2b4b]`}>Prev</td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO}} className={`sticky z-30 p-1 border-r border-b border-white/10 text-center font-bold text-gray-400 ${idx % 2 === 0 ? 'bg-[#0d1421]' : 'bg-[#0a0f18]'} group-hover:bg-[#1a2b4b]`}>{getGrandTotal(row, 'prev')}</td>
                                                
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'prev');
                                                    if (!exp) return <td key={`p-s-${m}`} className="p-1 border-r border-b border-white/5 text-center text-gray-600 bg-black/10 font-bold">{total}</td>;
                                                    return <React.Fragment key={`p-e-${m}`}>
                                                        <td className="p-1 border-r border-b border-blue-500/20 text-center bg-blue-500/10 text-blue-400/80 font-black">{total}</td>
                                                        {getMonthDays(m).map(d => (
                                                            <td key={d} className="p-0 border-r border-b border-white/5 w-[28px] bg-black/5">
                                                                <input type="text" value={row.daily_data?.[d]?.prev || ''} onChange={(e) => handleCellChange(row.id, d, 'prev', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent border-none outline-none text-gray-400 text-[10px] focus:bg-white/10" />
                                                            </td>
                                                        ))}
                                                    </React.Fragment>;
                                                })}
                                            </tr>
                                            <tr className={`${idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0a0f18]'} hover:bg-[#243b5e] group transition-colors border-b-2 border-white/10`}>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP}} className={`sticky z-30 p-1 border-r border-b-2 border-brand-accent/30 text-center text-[8px] font-black text-brand-accent uppercase ${idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0a0f18]'} group-hover:bg-[#243b5e]`}>Real</td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO}} className={`sticky z-30 p-1 border-r border-b-2 border-brand-accent/30 text-center font-black text-brand-accent ${idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0a0f18]'} group-hover:bg-[#243b5e]`}>{getGrandTotal(row, 'real')}</td>
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'real');
                                                    if (!exp) return <td key={`r-s-${m}`} className="p-1 border-r border-b-2 border-white/10 text-center text-brand-accent/80 bg-brand-accent/10 font-bold">{total}</td>;
                                                    return <React.Fragment key={`r-e-${m}`}>
                                                        <td className="p-1 border-r border-b-2 border-brand-accent/20 text-center bg-brand-accent/20 text-brand-accent font-black">{total}</td>
                                                        {getMonthDays(m).map(d => (
                                                            <td key={d} className="p-0 border-r border-b-2 border-white/10 w-[28px] bg-brand-accent/5">
                                                                <input type="text" value={row.daily_data?.[d]?.real || ''} onChange={(e) => handleCellChange(row.id, d, 'real', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent border-none outline-none text-white font-bold text-[10px] focus:bg-brand-accent/20" />
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
