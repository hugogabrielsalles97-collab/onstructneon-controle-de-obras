import React, { useState, useEffect, useMemo } from 'react';
import { User, MonitoringRow } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../context/DataProvider';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Save, Search, ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react';

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
    const [deleteConfirmRowId, setDeleteConfirmRowId] = useState<string | null>(null);
    const [isDeletingRow, setIsDeletingRow] = useState(false);

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
                        for (let i = 0; i < data.length; i++) {
                            allRows.push(data[i]);
                        }
                        if (data.length < 1000) {
                            hasMore = false;
                        } else {
                            from += 1000;
                            // Yield to browser to prevent "Unresponsive Page" freeze
                            await new Promise(r => setTimeout(r, 0));
                        }
                    } else {
                        hasMore = false;
                    }
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

    useEffect(() => {
        if (!deleteConfirmRowId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isDeletingRow) setDeleteConfirmRowId(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [deleteConfirmRowId, isDeletingRow]);

    const pendingDeleteRow = useMemo(
        () => (deleteConfirmRowId ? monitoringRows.find((r) => r.id === deleteConfirmRowId) : undefined),
        [deleteConfirmRowId, monitoringRows]
    );

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

    const getMonthTotal = (row: MonitoringRow, monthKey: string, type: 'prev' | 'real' | 'lb05') => {
        let sum = 0;
        const days = getMonthDays(monthKey);
        days.forEach(d => sum += row.daily_data?.[d]?.[type] || 0);
        return sum;
    };

    const getGrandTotal = (row: MonitoringRow, type: 'prev' | 'real' | 'lb05') => {
        let sum = 0;
        Object.values(row.daily_data || {}).forEach(vals => sum += (vals as any)[type] || 0);
        return sum;
    };

    const handleCellChange = (rowId: string, dateKey: string, type: 'prev' | 'real' | 'lb05', value: string) => {
        const val = value.replace(',', '.');
        const num = parseFloat(val);
        setMonitoringRows(prev => prev.map(r => {
            if (r.id === rowId) {
                const newData = { ...r.daily_data };
                if (!newData[dateKey]) newData[dateKey] = { prev: 0, real: 0, lb05: 0 };
                newData[dateKey] = { ...newData[dateKey], [type]: isNaN(num) ? 0 : num };
                return { ...r, daily_data: newData };
            }
            return r;
        }));
    };

    const handleMetaChange = (rowId: string, field: 'oae' | 'apoio' | 'responsible', value: string) => {
        setMonitoringRows(prev => prev.map(r => (r.id === rowId ? { ...r, [field]: value } : r)));
    };

    const newRowId = () =>
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? `manual_${crypto.randomUUID()}`
            : `manual_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const handleAddRow = () => {
        if (!selectedService) {
            showToast('Selecione um serviço nas abas antes de adicionar uma linha.', 'error');
            return;
        }
        const row: MonitoringRow = {
            id: newRowId(),
            service: selectedService,
            oae: '',
            apoio: '',
            responsible: '',
            daily_data: {},
        };
        setMonitoringRows(prev => [...prev, row]);
    };

    const requestDeleteRow = (rowId: string) => {
        setDeleteConfirmRowId(rowId);
    };

    const cancelDeleteRow = () => {
        if (!isDeletingRow) setDeleteConfirmRowId(null);
    };

    const confirmDeleteRow = async () => {
        if (!deleteConfirmRowId) return;
        setIsDeletingRow(true);
        try {
            const rowId = deleteConfirmRowId;
            const { error } = await supabase.from('monitoring_rows').delete().eq('id', rowId);
            if (error) throw error;
            setMonitoringRows((prev) => {
                const next = prev.filter((r) => r.id !== rowId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return next;
            });
            setDeleteConfirmRowId(null);
            showToast('Linha excluída.', 'success');
        } catch (e: any) {
            console.error('Erro ao excluir linha:', e);
            showToast(e.message || 'Erro ao excluir linha.', 'error');
        } finally {
            setIsDeletingRow(false);
        }
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
        'CORTINA ATIRANTADA', 'SOLO GRAMPEADO',
        'MACADAME', 'BGTC', 'BGMC', 'BGS', 'CBUQ'
    ];

    // Serviços que sempre aparecem como abas, mesmo sem linhas cadastradas,
    // para permitir adicionar as linhas de distribuição depois.
    const baseServices = [
        'MACADAME', 'BGTC', 'BGMC', 'BGS'
    ];

    const isTrechoService = selectedService === 'CBUQ';
    const isCorteService = selectedService === 'CORTINA ATIRANTADA' || selectedService === 'SOLO GRAMPEADO';
    const col1Label = isTrechoService ? 'Trecho' : (isCorteService ? 'Corte' : 'OAE');
    const col2Label = isCorteService || isTrechoService ? 'FT' : 'Apoio';

    const services = Array.from(new Set([...monitoringRows.map(r => r.service), ...baseServices]) as Set<string>).sort((a, b) => {
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
    const W_DEL = 58;
    const LEFT_STICKY_DEL = W_OAE + W_APOIO + W_RESP + W_INFO + W_TOTAL;

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
                            <button type="button" onClick={handleAddRow} className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-xl font-bold text-xs uppercase shadow-xl transition-all active:scale-95"><Plus size={14} /> Nova linha</button>
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
                                <thead>
                                    <tr className="text-gray-500 font-extrabold uppercase tracking-widest text-[9px] h-8">
                                        <th style={{width: W_OAE, left: 0, top: 0, background: '#0a0f18'}} className="sticky z-[200] p-3 border-b border-r border-white/20 text-left" rowSpan={2}>{col1Label}</th>
                                        <th style={{width: W_APOIO, left: W_OAE, top: 0, background: '#0a0f18'}} className="sticky z-[200] p-3 border-b border-r border-white/20 text-left" rowSpan={2}>{col2Label}</th>
                                        <th style={{width: W_RESP, left: W_OAE + W_APOIO, top: 0, background: '#0a0f18'}} className="sticky z-[200] p-3 border-b border-r border-white/20 text-left" rowSpan={2}>Engenheiro</th>
                                        <th style={{width: W_INFO, left: W_OAE + W_APOIO + W_RESP, top: 0, background: '#0a0f18'}} className="sticky z-[200] p-3 border-b border-r border-white/10 text-center" rowSpan={2}>Info</th>
                                        <th style={{width: W_TOTAL, left: W_OAE + W_APOIO + W_RESP + W_INFO, top: 0, background: '#0a0f18'}} className="sticky z-[200] p-3 border-b border-r border-brand-accent/50 text-center font-black text-brand-accent" rowSpan={2}>TOTAL</th>
                                        <th style={{width: W_DEL, left: LEFT_STICKY_DEL, top: 0, background: '#0a0f18'}} className="sticky z-[200] px-1 py-2 border-b border-r border-white/20 text-center font-extrabold text-[8px] uppercase tracking-tight text-gray-400" rowSpan={2} title="Remover linha do serviço">Ações</th>
                                        
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            return <th key={m} colSpan={exp ? getMonthDays(m).length + 1 : 1} onClick={() => toggleMonth(m)} style={{top: 0, background: '#0a0f18'}} className="sticky z-[100] p-2 border-b border-r border-white/10 text-center cursor-pointer hover:bg-white/5 transition-all">
                                                <div className="flex items-center justify-center gap-1 uppercase select-none tracking-tight">
                                                    {exp ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                                    {new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1])-1).toLocaleString('pt-BR', {month: 'short', year: '2-digit'})}
                                                </div>
                                            </th>;
                                        })}
                                    </tr>
                                    <tr className="text-[8px] text-gray-600 h-7">
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            if (!exp) return <th key={`sub-${m}`} style={{top: 32, background: '#0a0f18'}} className="sticky z-[100] p-1 border-b border-r border-white/10 text-center">RESUMO</th>;
                                            return <React.Fragment key={`sub-exp-${m}`}>
                                                <th style={{top: 32, background: '#0a1520'}} className="sticky z-[100] p-1 border-b border-r border-cyan-500/30 text-center text-cyan-400">RESUMO</th>
                                                {getMonthDays(m).map(d => <th key={d} style={{top: 32, background: '#0a0f18'}} className="sticky z-[100] p-1 border-b border-r border-white/5 text-center font-medium w-[28px]">{d.split('-')[2]}</th>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>
                                </thead>

                                <tbody>
                                    {/* TOTAL GERAL ROW - LB04 (PREV) — sticky individual nas cells */}
                                    <tr style={{background: '#1a1f2c'}} className="h-8">
                                        <td style={{left: 0, top: 60, width: W_OAE, background: '#1a1f2c'}} className="sticky z-[160] px-2 pt-4 pb-0 border-r text-brand-accent text-center font-black uppercase text-[11px] align-bottom">TOTAL</td>
                                        <td style={{left: W_OAE, top: 60, width: W_APOIO + W_RESP, background: '#1a1f2c', minWidth: W_APOIO + W_RESP}} colSpan={2} className="sticky z-[160] px-2 pt-4 pb-0 border-r text-brand-accent text-center font-black uppercase text-[11px] align-bottom">GERAL</td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP, top: 60, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b border-white/10 text-center text-[9px] font-black text-gray-200 uppercase">LB04</td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO, top: 60, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b border-brand-accent/30 text-center text-gray-100 font-black text-[11px]">
                                            {filteredRows.reduce((a, r) => a + getGrandTotal(r, 'prev'), 0).toLocaleString('pt-BR')}
                                        </td>
                                        <td style={{left: LEFT_STICKY_DEL, top: 60, width: W_DEL, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b border-brand-accent/30 text-center" aria-hidden />
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            const monthSum = filteredRows.reduce((a, r) => a + getMonthTotal(r, m, 'prev'), 0);
                                            if (!exp) return <td key={`GP-${m}`} style={{top: 60, background: '#1a1f2c'}} className="sticky z-[120] p-1 border-r border-b border-brand-accent/20 text-center font-black text-gray-300 text-[11px]">{monthSum.toLocaleString('pt-BR')}</td>;
                                            return <React.Fragment key={`GP-exp-${m}`}>
                                                <td style={{top: 60, background: '#0f2a3a'}} className="sticky z-[120] p-1 border-r border-b border-cyan-500/30 text-center text-cyan-400 font-black text-[11px]">{monthSum.toLocaleString('pt-BR')}</td>
                                                {getMonthDays(m).map(d => <td key={`GP-d-${d}`} style={{top: 60, background: '#1a1f2c'}} className="sticky z-[120] p-1 border-r border-b border-white/10 text-center text-gray-400 font-bold">{filteredRows.reduce((a, r) => a + (r.daily_data?.[d]?.prev || 0), 0)}</td>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>
                                    {/* TOTAL GERAL ROW - REAL */}
                                    <tr style={{background: '#1a1f2c'}} className="h-8">
                                        <td style={{left: 0, top: 92, width: W_OAE, background: '#1a1f2c'}} className="sticky z-[160] px-2 py-0 border-r border-brand-accent/30"></td>
                                        <td style={{left: W_OAE, top: 92, width: W_APOIO + W_RESP, background: '#1a1f2c', minWidth: W_APOIO + W_RESP}} colSpan={2} className="sticky z-[160] px-2 py-0 border-r border-brand-accent/30"></td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP, top: 92, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b border-brand-accent/30 text-center text-[8px] font-black text-brand-accent uppercase">REAL</td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO, top: 92, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b border-brand-accent/30 text-center text-brand-accent font-black text-[11px]">
                                            {filteredRows.reduce((a, r) => a + getGrandTotal(r, 'real'), 0).toLocaleString('pt-BR')}
                                        </td>
                                        <td style={{left: LEFT_STICKY_DEL, top: 92, width: W_DEL, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b border-brand-accent/30" aria-hidden />
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            const monthSum = filteredRows.reduce((a, r) => a + getMonthTotal(r, m, 'real'), 0);
                                            if (!exp) return <td key={`GR-${m}`} style={{top: 92, background: '#1a1f2c'}} className="sticky z-[120] p-1 border-r border-b border-brand-accent/30 text-center font-black text-brand-accent text-[11px]">{monthSum.toLocaleString('pt-BR')}</td>;
                                            return <React.Fragment key={`GR-exp-${m}`}>
                                                <td style={{top: 92, background: '#2a1810'}} className="sticky z-[120] p-1 border-r border-b border-brand-accent/40 text-center text-brand-accent font-black text-[11px]">{monthSum.toLocaleString('pt-BR')}</td>
                                                {getMonthDays(m).map(d => <td key={`GR-d-${d}`} style={{top: 92, background: '#1a1f2c'}} className="sticky z-[120] p-1 border-r border-b border-white/10 text-center text-brand-accent font-black">{filteredRows.reduce((a, r) => a + (r.daily_data?.[d]?.real || 0), 0)}</td>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>
                                    {/* TOTAL GERAL ROW - LB05 */}
                                    <tr style={{background: '#1a1f2c'}} className="h-8">
                                        <td style={{left: 0, top: 124, width: W_OAE, background: '#1a1f2c'}} className="sticky z-[160] px-2 pt-0 pb-4 border-r border-b-2 border-brand-accent/30"></td>
                                        <td style={{left: W_OAE, top: 124, width: W_APOIO + W_RESP, background: '#1a1f2c', minWidth: W_APOIO + W_RESP}} colSpan={2} className="sticky z-[160] px-2 pt-0 pb-4 border-r border-b-2 border-brand-accent/30"></td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP, top: 124, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b-2 border-cyan-500/40 text-center text-[8px] font-black text-cyan-400 uppercase">LB05</td>
                                        <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO, top: 124, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b-2 border-cyan-500/40 text-center text-cyan-400 font-black text-[11px]">
                                            {filteredRows.reduce((a, r) => a + getGrandTotal(r, 'lb05'), 0).toLocaleString('pt-BR')}
                                        </td>
                                        <td style={{left: LEFT_STICKY_DEL, top: 124, width: W_DEL, background: '#1a1f2c'}} className="sticky z-[160] p-1 border-r border-b-2 border-cyan-500/40" aria-hidden />
                                        {availableMonths.map(m => {
                                            const exp = expandedMonths.has(m);
                                            const monthSum = filteredRows.reduce((a, r) => a + getMonthTotal(r, m, 'lb05'), 0);
                                            if (!exp) return <td key={`GL-${m}`} style={{top: 124, background: '#1a1f2c'}} className="sticky z-[120] p-1 border-r border-b-2 border-cyan-500/30 text-center font-black text-cyan-400 text-[11px]">{monthSum.toLocaleString('pt-BR')}</td>;
                                            return <React.Fragment key={`GL-exp-${m}`}>
                                                <td style={{top: 124, background: '#0f2a3a'}} className="sticky z-[120] p-1 border-r border-b-2 border-cyan-500/40 text-center text-cyan-400 font-black text-[11px]">{monthSum.toLocaleString('pt-BR')}</td>
                                                {getMonthDays(m).map(d => <td key={`GL-d-${d}`} style={{top: 124, background: '#1a1f2c'}} className="sticky z-[120] p-1 border-r border-b-2 border-white/10 text-center text-cyan-400 font-black">{filteredRows.reduce((a, r) => a + (r.daily_data?.[d]?.lb05 || 0), 0)}</td>)}
                                            </React.Fragment>;
                                        })}
                                    </tr>

                                    {/* DATA ROWS — visual merge via same bg + no border between rows */}
                                    {filteredRows.map((row, idx) => {
                                        const bg = idx % 2 === 0 ? '#0d1421' : '#0a0f18';
                                        return (
                                        <React.Fragment key={row.id}>
                                            {/* PREV ROW — mostra OAE/Apoio/Eng, sem borda inferior nessas 3 cols */}
                                            <tr style={{background: bg}} className="group transition-colors">
                                                <td style={{left: 0, background: bg}} className="sticky z-[140] p-0 pt-3 pb-0 border-r border-white/10 group-hover:!bg-[#1a2b4b] align-bottom">
                                                    <input type="text" value={row.oae} onChange={(e) => handleMetaChange(row.id, 'oae', e.target.value)} placeholder="—"
                                                        className="w-full min-w-0 px-2 py-1 bg-transparent border-none outline-none text-white font-bold text-[10px] focus:bg-white/10 rounded placeholder:text-gray-600" />
                                                </td>
                                                <td style={{left: W_OAE, background: bg}} className="sticky z-[140] p-0 pt-3 pb-0 border-r border-white/10 group-hover:!bg-[#1a2b4b] align-bottom">
                                                    <input type="text" value={row.apoio} onChange={(e) => handleMetaChange(row.id, 'apoio', e.target.value)} placeholder="—"
                                                        className="w-full min-w-0 px-2 py-1 bg-transparent border-none outline-none text-blue-400 font-black text-[10px] text-center focus:bg-white/10 rounded placeholder:text-blue-900/40" />
                                                </td>
                                                <td style={{left: W_OAE + W_APOIO, background: bg}} className="sticky z-[140] p-0 pt-3 pb-0 border-r border-white/10 group-hover:!bg-[#1a2b4b] align-bottom">
                                                    <input type="text" value={row.responsible ?? ''} onChange={(e) => handleMetaChange(row.id, 'responsible', e.target.value)} placeholder="—"
                                                        className="w-full min-w-0 px-2 py-1 bg-transparent border-none outline-none text-gray-300 font-semibold text-[10px] focus:bg-white/10 rounded placeholder:text-gray-600" />
                                                </td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP, background: bg}} className="sticky z-[140] p-1 border-r border-b border-blue-500/30 text-center text-[8px] font-black text-blue-500 uppercase group-hover:!bg-[#1a2b4b]">LB04</td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO, background: bg}} className="sticky z-[140] p-1 border-r border-b border-white/10 text-center font-bold text-gray-400 group-hover:!bg-[#1a2b4b]">{getGrandTotal(row, 'prev')}</td>
                                                <td style={{left: LEFT_STICKY_DEL, background: bg}} className="sticky z-[140] p-0.5 border-r border-b border-white/10 text-center align-bottom group-hover:!bg-[#1a2b4b]">
                                                    <button
                                                        type="button"
                                                        title="Excluir esta linha"
                                                        onClick={(e) => { e.stopPropagation(); requestDeleteRow(row.id); }}
                                                        className="inline-flex flex-col items-center justify-center gap-0 w-full py-1 px-0.5 rounded border border-red-500/60 bg-red-950/50 text-red-400 hover:bg-red-500/25"
                                                    >
                                                        <Trash2 size={12} strokeWidth={2.5} className="shrink-0 text-red-400" />
                                                        <span className="text-[6px] font-black uppercase leading-none tracking-tight">Excluir</span>
                                                    </button>
                                                </td>
                                                
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
                                            {/* REAL ROW — linha do meio, mesma cor bg nas 3 primeiras (simula merge) */}
                                            <tr style={{background: bg}} className="group transition-colors">
                                                <td style={{left: 0, background: bg}} className="sticky z-[140] px-2 py-0 border-r border-white/10 group-hover:!bg-[#243b5e]"></td>
                                                <td style={{left: W_OAE, background: bg}} className="sticky z-[140] px-2 py-0 border-r border-white/10 group-hover:!bg-[#243b5e]"></td>
                                                <td style={{left: W_OAE + W_APOIO, background: bg}} className="sticky z-[140] px-2 py-0 border-r border-white/10 group-hover:!bg-[#243b5e]"></td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP, background: bg}} className="sticky z-[140] p-1 border-r border-b border-brand-accent/30 text-center text-[8px] font-black text-brand-accent uppercase group-hover:!bg-[#243b5e]">Real</td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO, background: bg}} className="sticky z-[140] p-1 border-r border-b border-brand-accent/30 text-center font-black text-brand-accent group-hover:!bg-[#243b5e]">{getGrandTotal(row, 'real')}</td>
                                                <td style={{left: LEFT_STICKY_DEL, background: bg}} className="sticky z-[140] p-1 border-r border-b border-brand-accent/30 group-hover:!bg-[#243b5e]" aria-hidden />
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'real');
                                                    if (!exp) return <td key={`r-s-${m}`} className="p-1 border-r border-b border-white/10 text-center text-brand-accent/80 bg-brand-accent/10 font-bold">{total}</td>;
                                                    return <React.Fragment key={`r-e-${m}`}>
                                                        <td className="p-1 border-r border-b border-brand-accent/20 text-center bg-brand-accent/20 text-brand-accent font-black">{total}</td>
                                                        {getMonthDays(m).map(d => (
                                                            <td key={d} className="p-0 border-r border-b border-white/10 w-[28px] bg-brand-accent/5">
                                                                <input type="text" value={row.daily_data?.[d]?.real || ''} onChange={(e) => handleCellChange(row.id, d, 'real', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent border-none outline-none text-white font-bold text-[10px] focus:bg-brand-accent/20" />
                                                            </td>
                                                        ))}
                                                    </React.Fragment>;
                                                })}
                                            </tr>
                                            {/* LB05 ROW — linha inferior que fecha o grupo, editável e salva na base */}
                                            <tr style={{background: bg}} className="group transition-colors">
                                                <td style={{left: 0, background: bg}} className="sticky z-[140] px-2 pt-0 pb-4 border-r border-b-2 border-white/10 group-hover:!bg-[#10303f]"></td>
                                                <td style={{left: W_OAE, background: bg}} className="sticky z-[140] px-2 pt-0 pb-4 border-r border-b-2 border-white/10 group-hover:!bg-[#10303f]"></td>
                                                <td style={{left: W_OAE + W_APOIO, background: bg}} className="sticky z-[140] px-2 pt-0 pb-4 border-r border-b-2 border-white/10 group-hover:!bg-[#10303f]"></td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP, background: bg}} className="sticky z-[140] p-1 border-r border-b-2 border-cyan-500/40 text-center text-[8px] font-black text-cyan-400 uppercase group-hover:!bg-[#10303f]">LB05</td>
                                                <td style={{left: W_OAE + W_APOIO + W_RESP + W_INFO, background: bg}} className="sticky z-[140] p-1 border-r border-b-2 border-cyan-500/40 text-center font-black text-cyan-400 group-hover:!bg-[#10303f]">{getGrandTotal(row, 'lb05')}</td>
                                                <td style={{left: LEFT_STICKY_DEL, background: bg}} className="sticky z-[140] p-1 border-r border-b-2 border-cyan-500/40 group-hover:!bg-[#10303f]" aria-hidden />
                                                {availableMonths.map(m => {
                                                    const exp = expandedMonths.has(m);
                                                    const total = getMonthTotal(row, m, 'lb05');
                                                    if (!exp) return <td key={`l-s-${m}`} className="p-1 border-r border-b-2 border-cyan-500/20 text-center text-cyan-400/80 bg-cyan-500/10 font-bold">{total}</td>;
                                                    return <React.Fragment key={`l-e-${m}`}>
                                                        <td className="p-1 border-r border-b-2 border-cyan-500/20 text-center bg-cyan-500/15 text-cyan-400 font-black">{total}</td>
                                                        {getMonthDays(m).map(d => (
                                                            <td key={d} className="p-0 border-r border-b-2 border-white/10 w-[28px] bg-cyan-500/5">
                                                                <input type="text" value={row.daily_data?.[d]?.lb05 || ''} onChange={(e) => handleCellChange(row.id, d, 'lb05', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent border-none outline-none text-cyan-300 font-bold text-[10px] focus:bg-cyan-500/20" />
                                                            </td>
                                                        ))}
                                                    </React.Fragment>;
                                                })}
                                            </tr>
                                        </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            {deleteConfirmRowId && pendingDeleteRow && (
                <div
                    className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
                    role="presentation"
                    onClick={cancelDeleteRow}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-row-title"
                        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0f1624] p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="delete-row-title" className="text-lg font-black uppercase italic tracking-tight text-white">
                            Confirmar exclusão
                        </h2>
                        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                            Esta linha será removida do sistema. Os dados de previsão e realizado associados a ela serão perdidos. Esta ação não pode ser desfeita.
                        </p>
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-300 space-y-1">
                            <p><span className="font-bold text-gray-500 uppercase tracking-wider">{col1Label}:</span> {pendingDeleteRow.oae?.trim() || '—'}</p>
                            <p><span className="font-bold text-gray-500 uppercase tracking-wider">{col2Label}:</span> {pendingDeleteRow.apoio?.trim() || '—'}</p>
                            <p><span className="font-bold text-gray-500 uppercase tracking-wider">Eng.:</span> {(pendingDeleteRow.responsible || '').trim() || '—'}</p>
                            <p><span className="font-bold text-gray-500 uppercase tracking-wider">Serviço:</span> {pendingDeleteRow.service}</p>
                        </div>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                disabled={isDeletingRow}
                                onClick={cancelDeleteRow}
                                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isDeletingRow}
                                onClick={() => void confirmDeleteRow()}
                                className="rounded-xl border border-red-500/50 bg-red-600/90 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                {isDeletingRow ? 'Excluindo…' : 'Sim, excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonitoringControlPage;
