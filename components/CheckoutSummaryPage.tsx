
import React from 'react';
import { useData } from '../context/DataProvider';
import Sidebar from './Sidebar';
import Header from './Header';
import HistoryIcon from './icons/HistoryIcon';
import UserIcon from './icons/UserIcon';
import CalendarIcon from './icons/CalendarIcon';
import ClockIcon from './icons/ClockIcon';
import CircleIcon from './icons/CircleIcon';

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
    onNavigateToVisualControl?: () => void;
    onNavigateToTeams?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

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
    onNavigateToOrgChart, onNavigateToVisualControl,
    onNavigateToTeams,
    onUpgradeClick,
    showToast
}) => {
    const { currentUser, checkoutLogs, tasks, signOut, deleteCheckoutLog } = useData();

    const [filterLocation, setFilterLocation] = React.useState('');
    const [filterUser, setFilterUser] = React.useState('');
    const [selectedDates, setSelectedDates] = React.useState<string[]>([]);
    const [filterDiscipline, setFilterDiscipline] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState('');
    const [deletingLogId, setDeletingLogId] = React.useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    // Extract unique values for filters
    const users = Array.from(new Set(checkoutLogs.map(log => log.user_name))).sort();
    const locations = Array.from(new Set(tasks.map(t => t.location).filter(Boolean))).sort();
    const disciplines = Array.from(new Set(tasks.map(t => t.discipline).filter(Boolean))).sort();
    const availableDates = Array.from(new Set(checkoutLogs.map(log => formatDate(log.created_at)))).sort((a, b) => {
        return new Date((b as string).split('/').reverse().join('-')).getTime() - new Date((a as string).split('/').reverse().join('-')).getTime();
    });

    // Filter logs
    const filteredLogs = checkoutLogs.filter(log => {
        const task = tasks.find(t => t.id === log.task_id);
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

    // Group logs by day
    const logsByDay = filteredLogs.reduce((acc: Record<string, any[]>, log) => {
        const day = formatDate(log.created_at);
        if (!acc[day]) acc[day] = [];
        acc[day].push(log);
        return acc;
    }, {});

    const days = Object.keys(logsByDay).sort((a, b) => {
        return new Date(b.split('/').reverse().join('-')).getTime() - new Date(a.split('/').reverse().join('-')).getTime();
    });

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
        if (duration <= 0) return metadata.quantity.toFixed(2);
        return (metadata.quantity / duration).toFixed(2);
    };

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
                onNavigateToVisualControl={onNavigateToVisualControl}
                onUpgradeClick={onUpgradeClick}
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
                        {days.length === 0 ? (
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
                                                const taskFromState = tasks.find(t => t.id === log.task_id);
                                                const metadata = log.changes._metadata || (taskFromState ? {
                                                    location: taskFromState.location,
                                                    corte: taskFromState.corte,
                                                    startDate: taskFromState.startDate,
                                                    dueDate: taskFromState.dueDate,
                                                    quantity: taskFromState.quantity,
                                                    unit: taskFromState.unit
                                                } : null);

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
                                                                                        {calculateDailyQuantity(metadata) || '0.00'}
                                                                                        <span className="text-[10px] ml-1 opacity-50">{metadata?.unit || 'un'}</span>
                                                                                    </p>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-[8px] font-black text-amber-500/70 uppercase">Total Previsto</p>
                                                                                    <p className="text-sm text-white font-black">
                                                                                        {metadata?.quantity || '0.00'}
                                                                                        <span className="text-[10px] ml-1 opacity-50">{metadata?.unit || 'un'}</span>
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
                                                                                                    {field !== 'progress' && <span className="text-[10px] ml-1 opacity-70">{metadata?.unit || 'un'}</span>}
                                                                                                </span>
                                                                                                <span className="text-[9px] text-white/30 font-bold">
                                                                                                    ({field === 'progress' ? `${values.to}%` : `${values.to}${metadata?.unit || 'un'}`})
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
        </div>
    );
};

export default CheckoutSummaryPage;
