
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatNumberBR } from '../utils/formatters';
import { useData } from '../context/DataProvider';
import Sidebar from './Sidebar';
import Header from './Header';
import HistoryIcon from './icons/HistoryIcon';
import UserIcon from './icons/UserIcon';
import CalendarIcon from './icons/CalendarIcon';
import ClockIcon from './icons/ClockIcon';
import CircleIcon from './icons/CircleIcon';
import WhatsAppIcon from './icons/WhatsAppIcon';
import EyeIcon from './icons/EyeIcon';
import XIcon from './icons/XIcon';

interface CheckoutSummaryPageProps {
    onNavigateToHome?: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToCost: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToOrgSummary?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToTeams?: () => void;
    onUpgradeClick: () => void;
    onAddTask?: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getTranslatedField = (field: string) => {
    const translations: Record<string, string> = {
        status: 'Status',
        progress: 'Avanço',
        actualQuantity: 'Qtd Realizada',
        actualStartDate: 'Início Real',
        actualEndDate: 'Fim Real'
    };
    return translations[field] || field;
};

const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
        'ToDo': 'Pendente',
        'InProgress': 'Em Progresso',
        'Completed': 'Concluído'
    };
    return labels[status] || status;
};

const calculateDailyQuantity = (metadata: any) => {
    if (!metadata || !metadata.startDate || !metadata.dueDate || !metadata.quantity) return null;
    const start = new Date(metadata.startDate);
    const end = new Date(metadata.dueDate);
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (duration <= 0) return formatNumberBR(metadata.quantity, 2);
    return formatNumberBR(metadata.quantity / duration, 2);
};

const CheckoutSummaryPage: React.FC<CheckoutSummaryPageProps> = ({
    onNavigateToHome,
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToWarRoom,
    onNavigateToPodcast,
    onNavigateToCost,
    onNavigateToCheckoutSummary,
    onNavigateToOrgChart,
    onNavigateToOrgSummary,
    onNavigateToVisualControl,
    onNavigateToTeams,
    onUpgradeClick,
    onAddTask,
    showToast
}) => {
    const { currentUser, checkoutLogs, tasks, allUsers, signOut, deleteCheckoutLog } = useData();

    const [filterLocation, setFilterLocation] = React.useState('');
    const [filterUser, setFilterUser] = React.useState('');
    const [selectedDates, setSelectedDates] = React.useState<string[]>([]);
    const [filterDiscipline, setFilterDiscipline] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState('');
    const [deletingLogId, setDeletingLogId] = React.useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
    const [viewMode, setViewMode] = React.useState<'checkouts' | 'pendencias'>('checkouts');
    const [pendenciaDate, setPendenciaDate] = useState('');
    const [selectedPhotos, setSelectedPhotos] = useState<string[] | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedPhotos(null);
        };
        if (selectedPhotos) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPhotos]);

    // ==== OTIMIZAÇÃO: Map de tarefas por ID para lookup O(1) em vez de O(n) ====
    const taskMap = useMemo(() => {
        const map = new Map<string, typeof tasks[0]>();
        for (const t of tasks) {
            map.set(t.id, t);
        }
        return map;
    }, [tasks]);

    const handleDeleteCheckout = async (logId: string) => {
        setDeletingLogId(logId);
        const result = await deleteCheckoutLog(logId);
        if (result.success) {
            showToast('Checkout deletado com sucesso!', 'success');
        } else {
            showToast(`Erro ao deletar: ${result.error}`, 'error');
        }
        setDeletingLogId(null);
        setConfirmDeleteId(null);
    };

    if (!currentUser) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    // ==== OTIMIZAÇÃO: useMemo para valores de filtros ====
    const users = useMemo(
        () => Array.from(new Set(checkoutLogs.map(log => log.user_name))).sort(),
        [checkoutLogs]
    );
    const locations = useMemo(
        () => Array.from(new Set(tasks.map(t => t.location).filter(Boolean))).sort(),
        [tasks]
    );
    const disciplines = useMemo(
        () => Array.from(new Set(tasks.map(t => t.discipline).filter(Boolean))).sort(),
        [tasks]
    );
    const availableDates = useMemo(() => {
        return Array.from(new Set(checkoutLogs.map(log => formatDate(log.created_at)))).sort((a, b) => {
            return new Date((b as string).split('/').reverse().join('-')).getTime() - new Date((a as string).split('/').reverse().join('-')).getTime();
        });
    }, [checkoutLogs]);

    // ==== OTIMIZAÇÃO: useMemo para logs filtrados ====
    const filteredLogs = useMemo(() => {
        return checkoutLogs.filter(log => {
            const task = taskMap.get(log.task_id);
            const metadata = log.changes._metadata;

            const location = metadata?.location || task?.location;
            const discipline = task?.discipline;
            const status = log.changes.status?.to;

            if (filterLocation && location !== filterLocation) return false;
            if (filterUser && log.user_name !== filterUser) return false;
            if (selectedDates.length > 0 && !selectedDates.includes(formatDate(log.created_at))) return false;
            if (filterDiscipline && discipline !== filterDiscipline) return false;
            if (filterStatus && status !== filterStatus) return false;

            return true;
        });
    }, [checkoutLogs, taskMap, filterLocation, filterUser, selectedDates, filterDiscipline, filterStatus]);

    // ==== OTIMIZAÇÃO: useMemo para agrupamento por dia ====
    const { logsByDay, days } = useMemo(() => {
        const grouped = filteredLogs.reduce((acc: Record<string, any[]>, log) => {
            const day = formatDate(log.created_at);
            if (!acc[day]) acc[day] = [];
            acc[day].push(log);
            return acc;
        }, {});

        const sortedDays = Object.keys(grouped).sort((a, b) => {
            return new Date(b.split('/').reverse().join('-')).getTime() - new Date(a.split('/').reverse().join('-')).getTime();
        });

        return { logsByDay: grouped, days: sortedDays };
    }, [filteredLogs]);

    // ==== PENDÊNCIAS: Só calcula quando está na aba pendências E tem data selecionada ====
    const pendingCheckouts = useMemo(() => {
        if (viewMode !== 'pendencias' || !pendenciaDate) return [];

        const dayStrIso = pendenciaDate; // Formato YYYY-MM-DD do input de data

        // Passo 1: Filtrar tarefas que teriam atividade NESTE dia
        const tasksToConsider = tasks.filter(t => {
            if (!t.startDate || !t.dueDate || !t.assignee) return false;

            // REGRA: Atividades já concluídas (status ou data de fim preenchida) NÃO devem aparecer
            if (t.status === 'Completed') return false;
            if (t.actualEndDate) return false;

            // Comparação direta de strings YYYY-MM-DD (Seguro contra fuso horário)
            const isWithinRange = dayStrIso >= t.startDate && dayStrIso <= t.dueDate;
            return isWithinRange;
        });

        // Passo 2: Verificar quais dessas tarefas tiveram QUALQUER checkout neste dia
        // Precisamos converter log.created_at (ISO timestamp) para YYYY-MM-DD local
        const checkedOutTaskIdsOnThisDay = new Set<string>();
        for (const log of checkoutLogs) {
            const logDate = new Date(log.created_at);
            const logDateIso = logDate.getFullYear() + '-' +
                String(logDate.getMonth() + 1).padStart(2, '0') + '-' +
                String(logDate.getDate()).padStart(2, '0');

            if (logDateIso === dayStrIso) {
                checkedOutTaskIdsOnThisDay.add(log.task_id);
            }
        }

        // Passo 3: O resultado são as tarefas previstas que NÃO possuem checkout registrado
        const missing: { assignee: string; taskTitle: string; location: string; discipline: string; taskId: string }[] = [];
        const seenTaskIds = new Set<string>();

        for (const t of tasksToConsider) {
            // Se já houve checkout nesta tarefa no dia, pula
            if (checkedOutTaskIdsOnThisDay.has(t.id)) continue;
            // Evitar duplicatas (caso haja inconsistência no estado)
            if (seenTaskIds.has(t.id)) continue;

            if (filterLocation && t.location !== filterLocation) continue;
            if (filterDiscipline && t.discipline !== filterDiscipline) continue;
            if (filterUser && t.assignee !== filterUser) continue;

            missing.push({
                assignee: t.assignee,
                taskTitle: t.title,
                location: t.location || '-',
                discipline: t.discipline || '-',
                taskId: t.id
            });
            seenTaskIds.add(t.id);
        }

        return missing;
    }, [viewMode, pendenciaDate, tasks, checkoutLogs, filterLocation, filterDiscipline, filterUser]);

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={currentUser}
                activeScreen="checkoutSummary"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToPodcast={onNavigateToPodcast}
                onNavigateToCost={onNavigateToCost}
                onNavigateToCheckoutSummary={() => { }}
                onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToOrgSummary={onNavigateToOrgSummary}
                onNavigateToVisualControl={onNavigateToVisualControl}
                onUpgradeClick={onUpgradeClick}
                onAddTask={onAddTask}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50">
                <Header
                    user={currentUser}
                    onLogout={handleLogout}
                    onNavigateToHome={onNavigateToHome}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToReports={onNavigateToReports}
                    onNavigateToBaseline={onNavigateToBaseline}
                    onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={onNavigateToAnalysis}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onNavigateToCheckoutSummary={() => { }}
                    onNavigateToOrgChart={onNavigateToOrgChart}
                    onNavigateToOrgSummary={onNavigateToOrgSummary}
                    onNavigateToVisualControl={onNavigateToVisualControl}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="checkoutSummary"
                />

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 animate-slide-up">
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                    <HistoryIcon className="w-8 h-8 text-brand-accent" />
                                    Resumo Checkout
                                </h2>
                                <p className="text-sm text-brand-med-gray mt-1">Histórico de atualizações e controle de produção.</p>
                            </div>

                            {/* Toggle: Checkouts / Pendências */}
                            <div className="flex gap-1 p-1 bg-brand-darkest/60 rounded-xl border border-white/5">
                                <button
                                    onClick={() => setViewMode('checkouts')}
                                    className={`px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'checkouts'
                                        ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20'
                                        : 'text-brand-med-gray hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <HistoryIcon className="w-3.5 h-3.5" />
                                    Checkouts
                                </button>
                                <button
                                    onClick={() => setViewMode('pendencias')}
                                    className={`px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'pendencias'
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                        : 'text-brand-med-gray hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    Pendências
                                </button>
                            </div>
                        </div>

                        {/* Filters Section */}
                        <div className="bg-[#111827]/60 p-5 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl">
                            <div className="flex flex-wrap lg:flex-nowrap items-end gap-4">
                                {/* Frente / Local */}
                                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                                    <label className="text-[9px] text-brand-med-gray uppercase font-black tracking-[0.15em] px-1 opacity-60">Localização</label>
                                    <select
                                        value={filterLocation}
                                        onChange={(e) => setFilterLocation(e.target.value)}
                                        className="w-full bg-brand-darkest/40 border border-white/10 text-white text-[11px] font-bold rounded-xl px-3 py-2.5 outline-none focus:border-brand-accent/50 focus:bg-brand-darkest/60 transition-all cursor-pointer appearance-none hover:border-white/20"
                                    >
                                        <option value="">Todas as Frentes</option>
                                        {locations.map(l => (
                                            <option key={l} value={l}>{l}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Executante */}
                                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                                    <label className="text-[9px] text-brand-med-gray uppercase font-black tracking-[0.15em] px-1 opacity-60">Executante</label>
                                    <select
                                        value={filterUser}
                                        onChange={(e) => setFilterUser(e.target.value)}
                                        className="w-full bg-brand-darkest/40 border border-white/10 text-white text-[11px] font-bold rounded-xl px-3 py-2.5 outline-none focus:border-brand-accent/50 focus:bg-brand-darkest/60 transition-all cursor-pointer appearance-none hover:border-white/20"
                                    >
                                        <option value="">Todos os Usuários</option>
                                        {users.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Datas do Checkout */}
                                <div className="flex flex-col gap-1.5 flex-[1.5] min-w-[240px]">
                                    <label className="text-[9px] text-brand-med-gray uppercase font-black tracking-[0.15em] px-1 opacity-60">Datas do Checkout</label>
                                    <div className="relative group/dates">
                                        <div className="flex flex-wrap gap-1 p-1 bg-brand-darkest/40 border border-white/10 rounded-xl min-h-[42px] max-h-[100px] overflow-y-auto cursor-pointer hover:border-white/20 focus-within:border-brand-accent/50 transition-all">
                                            {selectedDates.length === 0 ? (
                                                <div className="flex items-center gap-2 h-full px-3 py-2">
                                                    <CalendarIcon className="w-3.5 h-3.5 text-brand-med-gray opacity-40" />
                                                    <span className="text-[11px] text-brand-med-gray font-bold">Todas as Datas</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1 p-1">
                                                    {selectedDates.map(date => (
                                                        <span key={date} className="bg-brand-accent/20 text-brand-accent text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1 group/tag animate-scale-in">
                                                            {date}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedDates(prev => prev.filter(d => d !== date));
                                                                }}
                                                                className="hover:text-white transition-colors"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Dropdown de Datas */}
                                        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#111827] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-3 z-[100] hidden group-hover/dates:block hover:block animate-slide-down backdrop-blur-2xl">
                                            <p className="text-[9px] font-black text-brand-med-gray uppercase mb-2 px-1 tracking-widest opacity-40">Selecione os dias</p>
                                            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                {availableDates.map(d => {
                                                    const dateStr = d as string;
                                                    const isSelected = selectedDates.includes(dateStr);
                                                    return (
                                                        <button
                                                            key={dateStr}
                                                            onClick={() => {
                                                                setSelectedDates(prev =>
                                                                    isSelected ? prev.filter(item => item !== dateStr) : [...prev, dateStr]
                                                                );
                                                            }}
                                                            className={`text-left px-3 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-between group/item ${isSelected
                                                                ? 'bg-brand-accent text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)]'
                                                                : 'text-brand-med-gray hover:bg-white/5 hover:text-white'
                                                                }`}
                                                        >
                                                            {dateStr}
                                                            {isSelected && <CircleIcon className="w-1.5 h-1.5 fill-current" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Disciplina */}
                                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                                    <label className="text-[9px] text-brand-med-gray uppercase font-black tracking-[0.15em] px-1 opacity-60">Disciplina</label>
                                    <select
                                        value={filterDiscipline}
                                        onChange={(e) => setFilterDiscipline(e.target.value)}
                                        className="w-full bg-brand-darkest/40 border border-white/10 text-white text-[11px] font-bold rounded-xl px-3 py-2.5 outline-none focus:border-brand-accent/50 focus:bg-brand-darkest/60 transition-all cursor-pointer appearance-none hover:border-white/20"
                                    >
                                        <option value="">Todas as Disciplinas</option>
                                        {disciplines.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Status */}
                                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                                    <label className="text-[9px] text-brand-med-gray uppercase font-black tracking-[0.15em] px-1 opacity-60">Status Final</label>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="w-full bg-brand-darkest/40 border border-white/10 text-white text-[11px] font-bold rounded-xl px-3 py-2.5 outline-none focus:border-brand-accent/50 focus:bg-brand-darkest/60 transition-all cursor-pointer appearance-none hover:border-white/20"
                                    >
                                        <option value="">Qualquer Status</option>
                                        <option value="ToDo">Pendente</option>
                                        <option value="InProgress">Em Andamento</option>
                                        <option value="Completed">Concluído</option>
                                    </select>
                                </div>

                                {/* Clear Button */}
                                {(filterLocation || filterUser || selectedDates.length > 0 || filterDiscipline || filterStatus) && (
                                    <button
                                        onClick={() => {
                                            setFilterLocation('');
                                            setFilterUser('');
                                            setSelectedDates([]);
                                            setFilterDiscipline('');
                                            setFilterStatus('');
                                        }}
                                        className="flex items-center justify-center p-2.5 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-white transition-all shadow-lg group ml-auto lg:ml-0"
                                        title="Limpar Filtros"
                                    >
                                        <CircleIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ====== ABA PENDÊNCIAS ====== */}
                        {viewMode === 'pendencias' ? (
                            <div className="space-y-6">
                                {/* Seletor de data obrigatório */}
                                <div className="bg-[#111827]/60 p-6 rounded-2xl border border-red-500/10 shadow-2xl backdrop-blur-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                                            <CalendarIcon className="w-5 h-5 text-red-400" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 block">Selecione a data para verificar pendências</label>
                                            <input
                                                type="date"
                                                value={pendenciaDate}
                                                onChange={(e) => setPendenciaDate(e.target.value)}
                                                className="bg-brand-darkest/50 border border-white/10 text-white text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/10 transition-all w-full max-w-xs cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {!pendenciaDate ? (
                                    <div className="bg-[#111827]/40 border border-white/5 rounded-3xl p-16 text-center space-y-4">
                                        <div className="w-16 h-16 bg-red-500/5 rounded-full flex items-center justify-center mx-auto border border-red-500/10">
                                            <CalendarIcon className="w-8 h-8 text-red-400/30" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold text-white">Selecione uma data</h3>
                                            <p className="text-brand-med-gray max-w-sm mx-auto text-sm">Escolha o dia para verificar quais responsáveis não realizaram o checkout das atividades previstas.</p>
                                        </div>
                                    </div>
                                ) : pendingCheckouts.length === 0 ? (
                                    <div className="bg-green-500/5 border border-green-500/10 rounded-3xl p-16 text-center space-y-4 animate-fade-in">
                                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                <polyline points="22 4 12 14.01 9 11.01" />
                                            </svg>
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold text-green-400">Tudo em dia! ✓</h3>
                                            <p className="text-brand-med-gray max-w-sm mx-auto text-sm">Todos os responsáveis com atividades previstas para <strong className="text-white">{formatDate(pendenciaDate)}</strong> realizaram o checkout.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5 animate-fade-in">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-black text-red-400 uppercase tracking-tight">
                                                    Checkouts Pendentes — {formatDate(pendenciaDate)}
                                                </h4>
                                                <p className="text-[10px] text-red-300/60 font-medium">
                                                    Atividades não concluídas sem atualização neste dia
                                                </p>
                                            </div>
                                            <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/15 uppercase tracking-widest">
                                                {pendingCheckouts.length} pendente{pendingCheckouts.length > 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        <div className="grid gap-2">
                                            {pendingCheckouts.map((m, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 hover:bg-red-500/10 transition-all">
                                                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-[11px] font-black shrink-0">
                                                        {m.assignee.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-bold text-white truncate">{m.assignee}</p>
                                                        <p className="text-[10px] text-red-300/50 truncate">
                                                            {m.taskTitle} • {m.location} • {m.discipline}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[8px] font-black text-red-400/70 uppercase tracking-widest bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/10">
                                                            Sem checkout
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                const selectedUser = allUsers.find(u => u.fullName === m.assignee);
                                                                if (!selectedUser?.whatsapp) {
                                                                    alert("Responsável não possui WhatsApp cadastrado.");
                                                                    return;
                                                                }
                                                                const phone = selectedUser.whatsapp.replace(/\D/g, '');
                                                                const checkoutLink = `${window.location.origin}${window.location.pathname}?taskId=${m.taskId}&action=checkout`;
                                                                const message = `Olá *${selectedUser.fullName}*,%0A%0AIdentificamos que a atividade *${m.taskTitle}* (${m.location}) está sem checkout hoje (${formatDate(pendenciaDate)}).%0A%0A*Poderia atualizar o status no sistema, por favor?* 🙏🏗️%0A%0A👉 *Atualize aqui:* ${checkoutLink}`;
                                                                window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                                                            }}
                                                            className="p-2 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white rounded-lg transition-all duration-300 border border-green-500/20"
                                                            title="Notificar via WhatsApp"
                                                        >
                                                            <WhatsAppIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : /* ABA CHECKOUTS */ days.length === 0 ? (
                            <div className="bg-[#111827]/40 border border-white/5 rounded-3xl p-20 text-center space-y-4">
                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                    <HistoryIcon className="w-10 h-10 text-brand-med-gray opacity-20" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-white">Nenhum checkout encontrado</h3>
                                    <p className="text-brand-med-gray max-w-sm mx-auto">Tente ajustar seus filtros para encontrar o que procura.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {days.map(day => (
                                    <div key={day} className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent">
                                                <CalendarIcon className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">{day}</h3>
                                            <div className="flex-1 h-[1px] bg-white/5"></div>
                                            <span className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                                {logsByDay[day].length} {logsByDay[day].length === 1 ? 'Atualização' : 'Atualizações'}
                                            </span>
                                        </div>

                                        <div className="grid gap-3">
                                            {logsByDay[day].map((log) => {
                                                const taskFromState = taskMap.get(log.task_id);
                                                const metadata = log.changes._metadata || (taskFromState ? {
                                                    location: taskFromState.location,
                                                    corte: taskFromState.corte,
                                                    startDate: taskFromState.startDate,
                                                    dueDate: taskFromState.dueDate,
                                                    quantity: taskFromState.quantity,
                                                    unit: taskFromState.unit
                                                } : null);

                                                // FIX: Usar a unidade da tarefa real, não 'un' como fallback genérico
                                                const taskUnit = metadata?.unit || taskFromState?.unit || '';

                                                const entries = Object.entries(log.changes).filter(([k]) => k !== '_metadata');
                                                const realDates = entries.filter(([k]) => k === 'actualStartDate' || k === 'actualEndDate');
                                                const otherChanges = entries.filter(([k]) => k !== 'actualStartDate' && k !== 'actualEndDate');

                                                return (
                                                    <div key={log.id} className="group bg-[#111827]/40 hover:bg-[#111827]/60 border border-white/5 rounded-xl p-4 smooth-transition relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                                        <div className="flex flex-col gap-4">
                                                            {/* Compact Header */}
                                                            <div className="flex items-center justify-between border-b border-white/5 pb-3 gap-4">
                                                                {/* Left: title info */}
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-[8px] font-black text-brand-accent uppercase tracking-widest bg-brand-accent/10 px-1.5 py-0.5 rounded">Checkout</span>
                                                                        <span className="text-[10px] font-bold text-brand-med-gray flex items-center gap-1">
                                                                            <ClockIcon className="w-3 h-3" />
                                                                            {formatTime(log.created_at)}
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="text-lg font-black text-white group-hover:text-brand-accent smooth-transition tracking-tight leading-none truncate">
                                                                        {log.task_title}
                                                                    </h4>
                                                                </div>

                                                                {/* Right: user badge + delete */}
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    <div className="flex items-center gap-2 bg-white/5 px-2 py-1.5 rounded-lg border border-white/5">
                                                                        <div className="w-6 h-6 rounded-md bg-brand-accent flex items-center justify-center text-white text-[10px] font-black shadow-lg">
                                                                            {log.user_name.charAt(0)}
                                                                        </div>
                                                                        <p className="text-[11px] font-black text-white pr-1 whitespace-nowrap">{log.user_name}</p>
                                                                    </div>

                                                                    {/* Photos button */}
                                                                    {taskFromState?.photos && taskFromState.photos.length > 0 && (
                                                                        <button
                                                                            onClick={() => setSelectedPhotos(taskFromState.photos || null)}
                                                                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg transition-all duration-300 border border-blue-500/20 group/photo"
                                                                            title="Ver Fotos da Tarefa"
                                                                        >
                                                                            <EyeIcon className="w-4 h-4 group-hover/photo:scale-110 transition-transform" />
                                                                        </button>
                                                                    )}

                                                                    {/* Delete button */}
                                                                    {currentUser && (currentUser.role === 'Master' || currentUser.role === 'Gerenciador') && (
                                                                        <div className="relative">
                                                                            {confirmDeleteId === log.id ? (
                                                                                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 animate-slide-up">
                                                                                    <span className="text-[9px] text-red-400 font-bold whitespace-nowrap">Confirmar?</span>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteCheckout(log.id); }}
                                                                                        disabled={deletingLogId === log.id}
                                                                                        className="text-[9px] font-black text-white bg-red-500/80 hover:bg-red-500 px-2 py-0.5 rounded transition-all disabled:opacity-50"
                                                                                    >
                                                                                        {deletingLogId === log.id ? '...' : 'Sim'}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                                                                        className="text-[9px] font-black text-brand-med-gray hover:text-white px-2 py-0.5 rounded transition-all"
                                                                                    >
                                                                                        Não
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(log.id); }}
                                                                                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-red-500/10 text-brand-med-gray/40 hover:text-red-400 border border-transparent hover:border-red-500/20"
                                                                                    title="Deletar checkout"
                                                                                >
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                        <polyline points="3 6 5 6 21 6" />
                                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                                        <line x1="10" y1="11" x2="10" y2="17" />
                                                                                        <line x1="14" y1="11" x2="14" y2="17" />
                                                                                    </svg>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-4">
                                                                {/* Identification Row */}
                                                                <div className="flex flex-wrap gap-2">
                                                                    <div className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-2">
                                                                        <span className="text-[8px] font-black text-brand-med-gray uppercase">Local</span>
                                                                        <span className="text-[11px] text-white font-bold">{metadata?.location || '-'}</span>
                                                                    </div>
                                                                    <div className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-2">
                                                                        <span className="text-[8px] font-black text-brand-med-gray uppercase">Corte</span>
                                                                        <span className="text-[11px] text-white font-bold">{metadata?.corte || '-'}</span>
                                                                    </div>
                                                                    {log.changes.status && (
                                                                        <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-2 ml-auto ${log.changes.status.to === 'Completed' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                                                            log.changes.status.to === 'InProgress' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                                                'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                                                            }`}>
                                                                            <span className="text-[8px] font-black uppercase opacity-60">Novo Status</span>
                                                                            <span className="text-[11px] font-black tracking-tight uppercase">
                                                                                {getStatusLabel(log.changes.status.to)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Comparative Grid */}
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                    {/* Timeline Section: Planned vs Actual */}
                                                                    <div className="bg-[#1a2233]/40 rounded-xl border border-white/5 overflow-hidden flex flex-col">
                                                                        <div className="bg-white/[0.03] px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                                                                            <span className="text-[9px] font-black text-brand-med-gray uppercase tracking-widest">Cronograma</span>
                                                                            <span className="text-[8px] font-bold text-brand-med-gray/50 italic">Previsto vs Realizado</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-2 gap-4">
                                                                            {/* Planned Dates */}
                                                                            <div className="space-y-1">
                                                                                <p className="text-[8px] font-black text-amber-500/70 uppercase">Data Prevista</p>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[11px] text-white font-black leading-tight">
                                                                                        {metadata?.startDate ? formatDate(metadata.startDate) : '---'}
                                                                                    </span>
                                                                                    <span className="text-[9px] text-white/40 font-bold">Início</span>
                                                                                    <span className="text-[11px] text-white font-black leading-tight mt-1">
                                                                                        {metadata?.dueDate ? formatDate(metadata.dueDate) : '---'}
                                                                                    </span>
                                                                                    <span className="text-[9px] text-white/40 font-bold">Fim</span>
                                                                                </div>
                                                                            </div>
                                                                            {/* Real Dates */}
                                                                            <div className="space-y-1 border-l border-white/5 pl-4">
                                                                                <p className="text-[8px] font-black text-green-400/70 uppercase">Data Real</p>
                                                                                <div className="flex flex-col">
                                                                                    {['actualStartDate', 'actualEndDate'].map(field => {
                                                                                        const match = realDates.find(([k]) => k === field);
                                                                                        const values = match ? (match[1] as { from: any; to: any }) : null;
                                                                                        return (
                                                                                            <div key={field} className={field === 'actualEndDate' ? 'mt-1' : ''}>
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <span className="text-[11px] text-green-400 font-black leading-tight">
                                                                                                        {values?.to ? formatDate(values.to) : '---'}
                                                                                                    </span>
                                                                                                    {values?.from && (
                                                                                                        <span className="text-[8px] text-white/20 line-through">
                                                                                                            {formatDate(values.from)}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <span className="text-[9px] text-white/40 font-bold">
                                                                                                    {field === 'actualStartDate' ? 'Início' : 'Fim'}
                                                                                                </span>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Production Section: Goal vs Realized */}
                                                                    <div className="bg-[#1a2233]/40 rounded-xl border border-white/5 overflow-hidden flex flex-col">
                                                                        <div className="bg-white/[0.03] px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                                                                            <span className="text-[9px] font-black text-brand-med-gray uppercase tracking-widest">Produção e Avanço</span>
                                                                            <span className="text-[8px] font-bold text-brand-med-gray/50 italic">Metas vs Avanço Hoje</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-2 gap-4">
                                                                            {/* Goals */}
                                                                            <div className="space-y-2">
                                                                                <div>
                                                                                    <p className="text-[8px] font-black text-amber-500/70 uppercase">Meta (Dia)</p>
                                                                                    <p className="text-sm text-white font-black">
                                                                                        {calculateDailyQuantity(metadata) || "0,00"}
                                                                                        {taskUnit && <span className="text-[10px] ml-1 opacity-50">{taskUnit}</span>}
                                                                                    </p>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-[8px] font-black text-amber-500/70 uppercase">Total Previsto</p>
                                                                                    <p className="text-sm text-white font-black">
                                                                                        {formatNumberBR(metadata?.quantity || 0, 2)}
                                                                                        {taskUnit && <span className="text-[10px] ml-1 opacity-50">{taskUnit}</span>}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            {/* Realized Delta */}
                                                                            <div className="space-y-2 border-l border-white/5 pl-4">
                                                                                {['actualQuantity', 'progress'].map(field => {
                                                                                    const match = otherChanges.find(([k]) => k === field);
                                                                                    if (!match && field === 'actualQuantity') return null;

                                                                                    const values = match ? (match[1] as { from: any; to: any }) : { from: 0, to: 0 };
                                                                                    const isNumeric = typeof values.to === 'number' && typeof values.from === 'number';
                                                                                    const delta = isNumeric ? values.to - values.from : 0;

                                                                                    return (
                                                                                        <div key={field}>
                                                                                            <p className="text-[8px] font-black text-green-400/70 uppercase">
                                                                                                {field === 'progress' ? 'Avanço Realizado' : 'Qtd Realizada'}
                                                                                            </p>
                                                                                            <div className="flex items-baseline gap-2">
                                                                                                <span className="text-sm text-green-400 font-black">
                                                                                                    {field === 'progress'
                                                                                                        ? `+${delta.toFixed(1)}%`
                                                                                                        : `+${delta.toFixed(2)}`}
                                                                                                    {field !== 'progress' && taskUnit && <span className="text-[10px] ml-1 opacity-70">{taskUnit}</span>}
                                                                                                </span>
                                                                                                <span className="text-[9px] text-white/30 font-bold">
                                                                                                    ({field === "progress" ? formatNumberBR(values.to, 1) + "%" : formatNumberBR(values.to, 2) + (taskUnit ? ` ${taskUnit}` : "")})
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Photo Gallery Modal via Portal */}
            {selectedPhotos && selectedPhotos.length > 0 && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 bg-black/90 backdrop-blur-md"
                    onClick={() => setSelectedPhotos(null)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div className="relative max-w-6xl w-full max-h-[90vh] flex flex-col bg-[#0a0f18] rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header Area */}
                        <div className="flex justify-between items-center p-6 md:p-8 border-b border-white/5 shrink-0">
                            <div className="flex flex-col">
                                <h3 className="text-white font-black uppercase tracking-widest text-xl md:text-2xl italic">Galeria de Evidências</h3>
                                <p className="text-brand-accent font-black text-[10px] uppercase tracking-[4px] mt-1">
                                    {selectedPhotos.length} registro(s) fotográfico(s) • Clique p/ Ampliar
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedPhotos(null)}
                                className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white hover:bg-red-500 transition-all border border-white/10 group"
                                title="Fechar (Esc)"
                            >
                                <XIcon className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar flex items-center justify-center">
                            {selectedPhotos.length === 1 ? (
                                /* Single Image - Hero View */
                                <div className="w-full h-full max-h-[75vh] flex items-center justify-center">
                                    <div className="relative group w-full h-full flex items-center justify-center">
                                        <img
                                            src={selectedPhotos[0]}
                                            className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 cursor-zoom-in"
                                            alt="Evidência única"
                                            onClick={() => window.open(selectedPhotos[0], '_blank')}
                                        />
                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-widest">Clique p/ Abrir Original</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Multiple Images - Grid View */
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8 w-full max-w-5xl">
                                    {selectedPhotos.map((photo, i) => (
                                        <div key={i} className="group relative h-[45vh] md:h-[50vh] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-black/20 flex items-center justify-center p-2">
                                            <img
                                                src={photo}
                                                className="w-full h-full object-contain transition-all duration-700 group-hover:scale-105 cursor-zoom-in"
                                                loading="lazy"
                                                alt={`Evidência ${i + 1}`}
                                                onClick={() => window.open(photo, '_blank')}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-8 pointer-events-none">
                                                <span className="text-brand-accent font-black text-[10px] uppercase tracking-widest mb-1">Registro #{i + 1}</span>
                                                <span className="text-white font-bold text-xs">Visualizar em nova aba</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CheckoutSummaryPage;
