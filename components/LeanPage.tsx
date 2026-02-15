import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import { TaskStatus, Restriction, RestrictionType } from '../types';
import LeanIcon from './icons/LeanIcon';
import PpcChart from './PpcChart';
import AlertIcon from './icons/AlertIcon';
import RestrictionModal from './RestrictionModal';
import ClearIcon from './icons/ClearIcon';

interface LeanPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToCost: () => void;
    onNavigateToHome?: () => void;
    onNavigateToRestrictions: () => void;
    onSaveRestriction: (restriction: Omit<Restriction, 'id' | 'created_at' | 'user_id'>) => Promise<void>;
    onUpdateRestriction: (id: string, updates: Partial<Restriction>) => Promise<void>;
    onDeleteRestriction: (id: string) => Promise<void>;
    restrictions: Restriction[];
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}


const LeanPage: React.FC<LeanPageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToCost,
    onNavigateToHome,
    onNavigateToRestrictions,
    onSaveRestriction,
    onUpdateRestriction,
    onDeleteRestriction,
    restrictions,
    onUpgradeClick,
    showToast
}) => {
    const { currentUser: user, tasks, baselineTasks, currentScheduleTasks, cutOffDateStr, signOut } = useData();
    const [restrictionModal, setRestrictionModal] = useState<{
        taskId: string;
        taskTitle: string;
        taskStartDate: string;
        restriction?: Restriction; // Para edição
    } | null>(null);
    const [viewingTaskRestrictions, setViewingTaskRestrictions] = useState<{
        taskId: string;
        taskTitle: string;
        taskStartDate: string;
    } | null>(null);
    const [lookaheadWeeks, setLookaheadWeeks] = useState(2);
    const [filterDiscipline, setFilterDiscipline] = useState('');
    const [filterLocation, setFilterLocation] = useState('');

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    // Cálculos de Período (Lookahead de N semanas a partir da data de corte)
    const lookaheadData = useMemo(() => {
        const cutOffDate = new Date(cutOffDateStr);
        cutOffDate.setHours(0, 0, 0, 0);

        // Limite do lookahead: N semanas a partir da data de corte
        const endOfLookahead = new Date(cutOffDate);
        endOfLookahead.setDate(cutOffDate.getDate() + (lookaheadWeeks * 7));
        endOfLookahead.setHours(23, 59, 59, 999);

        // Filtrar apenas atividades reais (não marcos) e que não estejam já concluídas pelo corte
        const activeTasks = currentScheduleTasks.filter(bt => {
            // Excluir marcos: sem data de início ou data de fim
            if (!bt.startDate || !bt.dueDate) return false;

            const btStart = new Date(bt.startDate);
            const btEnd = new Date(bt.dueDate);
            btStart.setHours(0, 0, 0, 0);
            btEnd.setHours(0, 0, 0, 0);

            // Excluir marcos: início e fim no mesmo dia
            if (btStart.getTime() === btEnd.getTime()) return false;

            // Data de término anterior à data de corte = já concluída, não aparece
            if (btEnd < cutOffDate) return false;

            return true;
        }).map(bt => {
            const linkedTasks = tasks.filter(t => String(t.baseline_id) === String(bt.id));
            const totalPlannedQty = Number(bt.quantity) || 0;
            const rawActualQty = linkedTasks.reduce((acc, t) => acc + (Number(t.actualQuantity) || 0), 0);

            let progress = 0;
            if (totalPlannedQty > 0) progress = Math.min(100, (rawActualQty / totalPlannedQty) * 100);
            else if (linkedTasks.length > 0) progress = linkedTasks.reduce((acc, t) => acc + (Number(t.progress) || 0), 0) / linkedTasks.length;

            return {
                ...bt,
                currentProgress: Math.round(progress),
                linkedTasks,
                status: progress >= 100 ? 'Pronto' : progress > 0 ? 'Em Fluxo' : 'Planejado'
            };
        });

        // LOOKAHEAD:
        // Início > data de corte, limitado pelo filtro de semanas
        const nextWeekTasks = activeTasks
            .filter(t => {
                const btStart = new Date(t.startDate);
                btStart.setHours(0, 0, 0, 0);
                return btStart > cutOffDate && btStart <= endOfLookahead;
            })
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()); // Ordenar por início mais próximo

        const impactedRestrictionsCount = restrictions.filter(r => {
            if (!r.due_date || r.status === 'Resolvida') return false;
            const task = currentScheduleTasks.find(t => String(t.id) === String(r.baseline_task_id));
            if (!task) return false;

            const startDate = new Date(task.startDate);
            const impactLimit = new Date(startDate);
            impactLimit.setDate(startDate.getDate() - 2);

            return new Date(r.due_date) > impactLimit;
        }).length;

        // Opções únicas para filtros (apenas das tarefas do lookahead)
        const disciplines = Array.from(new Set(activeTasks.map(t => t.discipline).filter(Boolean))).sort();
        const locations = Array.from(new Set(activeTasks.map(t => t.location).filter(Boolean))).sort();

        return {
            nextWeekTasks,
            impactedRestrictionsCount,
            disciplines,
            locations
        };
    }, [currentScheduleTasks, tasks, restrictions, lookaheadWeeks, cutOffDateStr]);

    // SEMANA ATUAL (EXECUÇÃO): tarefas do Painel de Controle
    const dashboardTasks = useMemo(() => {
        return tasks
            .filter(t => {
                // Excluir tarefas concluídas ou com 100%
                if (t.status === 'Concluído') return false;
                if (t.progress >= 100) return false;
                return true;
            })
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [tasks]);

    // Aplicar filtros SOMENTE ao Lookahead
    const filteredNextWeek = useMemo(() => {
        return lookaheadData.nextWeekTasks.filter(t => {
            if (filterDiscipline && t.discipline !== filterDiscipline) return false;
            if (filterLocation && t.location !== filterLocation) return false;
            return true;
        });
    }, [lookaheadData.nextWeekTasks, filterDiscipline, filterLocation]);


    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    // Função para obter a cor do botão de restrições do header
    const getHeaderRestrictionButtonColor = () => {
        const activeRestrictions = restrictions.filter(r => r.status !== 'Resolvida');

        if (activeRestrictions.length === 0) {
            // Sem restrições: neutral com hover sutil
            return 'bg-white/5 text-gray-400 border-white/10 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20';
        }

        const hasCritical = activeRestrictions.some(r => r.priority === 'Crítica');
        if (hasCritical) return 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]';

        const hasHigh = activeRestrictions.some(r => r.priority === 'Alta');
        if (hasHigh) return 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]';

        const hasMedium = activeRestrictions.some(r => r.priority === 'Média');
        if (hasMedium) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20 hover:shadow-[0_0_20px_rgba(234,179,8,0.15)]';

        return 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]';
    };

    // Função para obter a cor do botão de restrição baseada na prioridade mais alta da TAREFA
    const getTaskRestrictionButtonColor = (taskId: string) => {
        const taskRestrictions = restrictions.filter(r => String(r.baseline_task_id) === String(taskId) && r.status !== 'Resolvida');

        if (taskRestrictions.length === 0) {
            // Cor neutra inicial (Premium Glass)
            return 'bg-white/5 text-brand-med-gray border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20 shadow-sm';
        }

        const hasCritical = taskRestrictions.some(r => r.priority === 'Crítica');
        if (hasCritical) return 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]';

        const hasHigh = taskRestrictions.some(r => r.priority === 'Alta');
        if (hasHigh) return 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]';

        const hasMedium = taskRestrictions.some(r => r.priority === 'Média');
        if (hasMedium) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]';

        return 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]';
    };

    return (
        <div className="flex flex-col h-screen">
            <Header
                user={user}
                onLogout={handleLogout}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={() => { }}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToCost={onNavigateToCost}
                onUpgradeClick={onUpgradeClick}
                activeScreen="lean"
            />
            {lookaheadData.impactedRestrictionsCount > 0 && (
                <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-3 animate-pulse font-black text-sm uppercase tracking-widest z-20">
                    <span>⚠️ {lookaheadData.impactedRestrictionsCount} RESTRIÇÕES COM PRAZO IMPACTANDO O INÍCIO DAS ATIVIDADES</span>
                </div>
            )}
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-[#0a0f18]">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header Lean */}
                    <div className="flex justify-between items-center bg-[#111827] p-6 rounded-2xl border border-white/5 shadow-2xl">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-accent/10 rounded-xl border border-brand-accent/20">
                                <LeanIcon className="w-8 h-8 text-brand-accent" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Sistema Last Planner</h2>
                                <p className="text-xs text-brand-med-gray uppercase font-bold tracking-[0.2em]">Lean Construction • Dashboard de Fluxo</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onNavigateToRestrictions}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-bold border-2 ${lookaheadData.impactedRestrictionsCount > 0 ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]' : getHeaderRestrictionButtonColor()}`}
                            >
                                <AlertIcon className="w-5 h-5" />
                                <span className="uppercase tracking-wider text-[11px]">Resumo de Restrições</span>
                                {restrictions.filter(r => r.status !== 'Resolvida').length > 0 && (
                                    <span className="ml-1 w-6 h-6 flex items-center justify-center bg-white/20 text-white rounded-full text-[10px] font-black shadow-inner">
                                        {restrictions.filter(r => r.status !== 'Resolvida').length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={onNavigateToDashboard}
                                className="px-6 py-2 bg-brand-dark/50 text-brand-med-gray rounded-xl hover:bg-brand-accent hover:text-white transition-all duration-300 font-bold border border-white/5"
                            >
                                ← Voltar
                            </button>
                        </div>
                    </div>

                    {/* Resumos Lean */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {/* Status do Fluxo */}
                        <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-brand-accent/10 transition-all"></div>
                            <h3 className="text-xs font-black text-brand-med-gray uppercase tracking-widest mb-4">Saúde do Fluxo</h3>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-white">{dashboardTasks.length}</span>
                                <span className="text-xs text-brand-med-gray font-bold mb-2">Atividades</span>
                            </div>
                            <p className="text-[11px] text-brand-med-gray mt-4 leading-relaxed">
                                Atividades que <span className="text-brand-accent font-bold">devem</span> estar em execução hoje.
                            </p>
                        </div>


                        {/* Total de Restrições */}
                        <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-orange-500/10 transition-all"></div>
                            <h3 className="text-xs font-black text-brand-med-gray uppercase tracking-widest mb-4">Restrições Ativas</h3>
                            <div className="flex items-end gap-2 text-orange-400">
                                <span className="text-4xl font-black">{restrictions.filter(r => r.status !== 'Resolvida').length}</span>
                                <span className="text-xs font-bold mb-2">Pendências Atuais</span>
                            </div>
                            <p className="text-[11px] text-brand-med-gray mt-4 leading-relaxed">
                                <span className="text-orange-400 font-bold">{lookaheadData.impactedRestrictionsCount}</span> impactam o início das tarefas.
                            </p>
                        </div>

                        {/* Lookahead Info */}
                        <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-purple-500/10 transition-all"></div>
                            <h3 className="text-xs font-black text-brand-med-gray uppercase tracking-widest mb-4">Lookahead ({lookaheadWeeks} sem)</h3>
                            <div className="flex items-end justify-between">
                                <div className="flex items-end gap-2 text-purple-400">
                                    <span className="text-4xl font-black">{lookaheadData.nextWeekTasks.length}</span>
                                    <span className="text-xs font-bold mb-2">Planejados</span>
                                </div>
                                <select
                                    value={lookaheadWeeks}
                                    onChange={(e) => setLookaheadWeeks(Number(e.target.value))}
                                    className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black rounded-lg px-2 py-1 outline-none focus:border-purple-500/50"
                                >
                                    <option value={1}>1 Sem</option>
                                    <option value={2}>2 Sem</option>
                                    <option value={3}>3 Sem</option>
                                    <option value={4}>4 Sem</option>
                                    <option value={5}>5 Sem</option>
                                    <option value={6}>6 Sem</option>
                                </select>
                            </div>
                            <p className="text-[11px] text-brand-med-gray mt-4 leading-relaxed">
                                Liberação de frentes para os próximos {lookaheadWeeks * 7} dias.
                            </p>
                        </div>
                    </div>

                    {/* Filtros de Disciplina e Frente */}
                    <div className="bg-[#111827] p-4 rounded-2xl border border-white/5 shadow-xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-1 h-4 bg-brand-accent rounded-full"></div>
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Filtros</h3>
                            {(filterDiscipline || filterLocation) && (
                                <button
                                    onClick={() => { setFilterDiscipline(''); setFilterLocation(''); }}
                                    className="ml-auto text-[10px] text-brand-med-gray hover:text-white font-bold flex items-center gap-1 transition-colors"
                                >
                                    <ClearIcon className="w-3.5 h-3.5" />
                                    Limpar
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-brand-med-gray uppercase font-black">Disciplina</label>
                                <select
                                    value={filterDiscipline}
                                    onChange={(e) => setFilterDiscipline(e.target.value)}
                                    className="bg-brand-darkest border border-white/10 text-white text-[11px] font-bold rounded-lg px-3 py-2 outline-none focus:border-brand-accent/50 min-w-[180px]"
                                >
                                    <option value="">Todas</option>
                                    {lookaheadData.disciplines.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-brand-med-gray uppercase font-black">Frente / Local</label>
                                <select
                                    value={filterLocation}
                                    onChange={(e) => setFilterLocation(e.target.value)}
                                    className="bg-brand-darkest border border-white/10 text-white text-[11px] font-bold rounded-lg px-3 py-2 outline-none focus:border-brand-accent/50 min-w-[180px]"
                                >
                                    <option value="">Todas</option>
                                    {lookaheadData.locations.map(l => (
                                        <option key={l} value={l}>{l}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Quadro de Programação Lookahead */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Semana Atual - O QUE ESTOU FAZENDO? */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-2 h-6 bg-brand-accent rounded-full"></div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Semana Atual (Execução)</h3>
                            </div>
                            <div className="space-y-3">
                                {dashboardTasks.length === 0 ? (
                                    <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-brand-med-gray text-sm">
                                        Nenhuma atividade programada no painel de controle.
                                    </div>
                                ) : (
                                    dashboardTasks.map(task => (
                                        <div key={task.id} className="bg-[#111827] border border-white/5 rounded-xl p-4 hover:border-brand-accent/30 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${task.status === 'Em Andamento' ? 'text-yellow-400 bg-yellow-400/10' : 'text-brand-accent bg-brand-accent/10'
                                                            }`}>{task.status}</span>
                                                        <span className="text-[10px] text-brand-med-gray uppercase font-bold">
                                                            {task.location}
                                                            {task.level && task.level !== '-' && ` • ${task.level}`}
                                                            {task.support && task.support !== '' && task.support !== 'undefined' && ` • ${task.support}`}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-100">{task.title}</h4>
                                                    {task.assignee && task.assignee !== '' && (
                                                        <p className="text-[10px] text-emerald-400 font-bold mt-1">Resp: {task.assignee}</p>
                                                    )}
                                                    <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${task.progress >= 100 ? 'bg-green-500' : 'bg-brand-accent'}`}
                                                            style={{ width: `${task.progress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col gap-2">
                                                    <div>
                                                        <span className={`text-[10px] font-black uppercase ${task.progress >= 100 ? 'text-green-500' : 'text-yellow-500'}`}>
                                                            {task.progress}%
                                                        </span>
                                                        <p className="text-[9px] text-brand-med-gray font-mono mt-0.5">FIM: {formatDate(task.dueDate)}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setViewingTaskRestrictions({ taskId: task.baseline_id || task.id, taskTitle: task.title, taskStartDate: task.startDate })}
                                                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-500 font-black text-[10px] uppercase tracking-[0.1em] border shadow-lg ${getTaskRestrictionButtonColor(task.baseline_id || task.id)}`}
                                                    >
                                                        <AlertIcon className="w-4 h-4" />
                                                        Restrições
                                                        {restrictions.filter(r => String(r.baseline_task_id) === String(task.baseline_id || task.id) && r.status !== 'Resolvida').length > 0 && (
                                                            <span className="w-5 h-5 flex items-center justify-center bg-white/20 text-white rounded-full text-[9px] font-black shadow-inner ml-0.5">
                                                                {restrictions.filter(r => String(r.baseline_task_id) === String(task.baseline_id || task.id) && r.status !== 'Resolvida').length}
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Lookahead - O QUE VOU FAZER? */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                                    Horizonte {lookaheadWeeks} Semana{lookaheadWeeks !== 1 && 's'} (Lookahead)
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {filteredNextWeek.length === 0 ? (
                                    <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-brand-med-gray text-sm">
                                        Monitorando o horizonte... Sem tarefas planejadas para as próximas {lookaheadWeeks} semanas.
                                    </div>
                                ) : (
                                    filteredNextWeek.map(task => (
                                        <div key={task.id} className="bg-[#111827]/60 border border-white/5 rounded-xl p-4 hover:border-purple-500/30 transition-all opacity-80 hover:opacity-100">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-purple-400 uppercase bg-purple-400/10 px-1.5 py-0.5 rounded">#{task.id}</span>
                                                        <span className="text-[10px] text-brand-med-gray uppercase font-bold">
                                                            {task.location}
                                                            {task.level && task.level !== '-' && ` • ${task.level}`}
                                                            {task.support && task.support !== '' && task.support !== 'undefined' && ` • ${task.support}`}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-300">{task.title}</h4>
                                                </div>
                                                <div className="text-right flex flex-col gap-2">
                                                    <div>
                                                        <p className="text-[10px] text-purple-400 font-bold">PLANEJADO</p>
                                                        <p className="text-[9px] text-brand-med-gray font-mono mt-1">INÍCIO: {formatDate(task.startDate)}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setViewingTaskRestrictions({ taskId: task.id, taskTitle: task.title, taskStartDate: task.startDate })}
                                                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-500 font-black text-[10px] uppercase tracking-[0.1em] border shadow-lg ${getTaskRestrictionButtonColor(task.id)}`}
                                                    >
                                                        <AlertIcon className="w-4 h-4" />
                                                        Restrições
                                                        {restrictions.filter(r => String(r.baseline_task_id) === String(task.id) && r.status !== 'Resolvida').length > 0 && (
                                                            <span className="w-5 h-5 flex items-center justify-center bg-white/20 text-white rounded-full text-[9px] font-black shadow-inner ml-0.5">
                                                                {restrictions.filter(r => String(r.baseline_task_id) === String(task.id) && r.status !== 'Resolvida').length}
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Insights de Desperdício (Muda) */}
                    <div className="bg-[#111827] border border-white/5 rounded-2xl p-8 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-black text-white mb-2">Gestão de Restrições</h3>
                            <p className="text-sm text-brand-med-gray mb-6 leading-relaxed max-w-3xl">
                                Para o Lean Construction, não basta Planejar. É preciso <span className="text-brand-accent">Remover Restrições</span>.
                                Confira se as frentes de serviço das próximas 2 semanas estão liberadas (Materiais, Equipamentos, Projetos e Mão de Obra).
                            </p>
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { name: 'Materiais', type: RestrictionType.Material },
                                    { name: 'Mão de Obra', type: RestrictionType.Labor },
                                    { name: 'Projetos', type: RestrictionType.Design },
                                    { name: 'Segurança', type: RestrictionType.Safety },
                                    { name: 'Ferramentas', type: RestrictionType.Equipment }
                                ].map(cat => {
                                    const activeCount = restrictions.filter(r => r.type === cat.type && r.status !== 'Resolvida').length;
                                    const hasRestriction = activeCount > 0;

                                    return (
                                        <div key={cat.name} className={`flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border transition-all duration-300 ${hasRestriction ? 'border-red-500/50 text-red-400' : 'border-white/10 text-brand-med-gray'} text-[10px] font-bold uppercase tracking-wider`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${hasRestriction ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                            {cat.name} {hasRestriction ? 'COM RESTRIÇÃO' : 'OK'}
                                            {hasRestriction && (
                                                <span className="ml-1 px-1.5 py-0.5 bg-red-500/20 rounded text-[9px]">{activeCount}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            {/* Modal de Gerenciamento de Restrições da Tarefa - PREMIUM DESIGN */}
            {viewingTaskRestrictions && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
                    {/* Backdrop com desfoque profundo */}
                    <div
                        className="absolute inset-0 bg-[#060a12]/80 backdrop-blur-2xl animate-fade-in"
                        onClick={() => setViewingTaskRestrictions(null)}
                    ></div>

                    {/* Modal Container Glassmorphism */}
                    <div className="relative w-full max-w-2xl bg-[#0a0f18]/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(227,90,16,0.15)] overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">

                        {/* Brand Accent Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-brand-accent to-transparent opacity-50"></div>

                        {/* Header */}
                        <div className="px-8 py-6 flex justify-between items-start border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-accent/20 flex items-center justify-center border border-brand-accent/30 shadow-lg shadow-brand-accent/10">
                                        <LeanIcon className="w-6 h-6 text-brand-accent" />
                                    </div>
                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">
                                        Restrições da <span className="text-brand-accent">Atividade</span>
                                    </h2>
                                </div>
                                <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                    Tarefa: <span className="text-white bg-white/5 px-2 py-0.5 rounded italic">{viewingTaskRestrictions.taskTitle}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingTaskRestrictions(null)}
                                className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-500 text-brand-med-gray transition-all group"
                            >
                                <ClearIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                            {restrictions
                                .filter(r => String(r.baseline_task_id) === String(viewingTaskRestrictions.taskId))
                                .sort((a, b) => {
                                    if (a.status === 'Resolvida' && b.status !== 'Resolvida') return 1;
                                    if (a.status !== 'Resolvida' && b.status === 'Resolvida') return -1;
                                    return 0;
                                })
                                .map(restriction => (
                                    <div
                                        key={restriction.id}
                                        className={`p-6 rounded-3xl border transition-all duration-300 group ${restriction.status === 'Resolvida'
                                            ? 'bg-green-500/5 border-green-500/10 opacity-60'
                                            : 'bg-white/5 border-white/5 hover:border-white/20 shadow-xl'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start gap-6">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg tracking-widest ${restriction.priority === 'Crítica' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' :
                                                        restriction.priority === 'Alta' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' :
                                                            restriction.priority === 'Média' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                                                'bg-green-500/20 text-green-500 border border-green-500/30'
                                                        }`}>
                                                        {restriction.priority}
                                                    </span>
                                                    <span className="text-[11px] text-brand-accent font-black uppercase tracking-[0.1em]">{restriction.type}</span>
                                                    {restriction.status === 'Resolvida' && (
                                                        <span className="flex items-center gap-1.5 text-[9px] font-black text-green-400 uppercase bg-green-400/10 px-2 py-1 rounded-lg">
                                                            <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                                                            Resolvida
                                                        </span>
                                                    )}
                                                </div>

                                                <p className={`text-base leading-relaxed font-medium ${restriction.status === 'Resolvida' ? 'text-gray-500 line-through italic' : 'text-gray-200'}`}>
                                                    {restriction.description}
                                                </p>

                                                <div className="grid grid-cols-2 gap-6 pt-2">
                                                    <div>
                                                        <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-[0.2em] mb-1.5">Responsável</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-brand-accent font-black">
                                                                {restriction.responsible.charAt(0)}
                                                            </div>
                                                            <p className="text-xs text-gray-300 font-bold">
                                                                {restriction.responsible}
                                                                {restriction.department && <span className="text-brand-med-gray/60 font-medium italic block text-[10px] mt-0.5">{restriction.department}</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-[0.2em] mb-1.5">Data Limite</p>
                                                        <p className={`text-xs font-black italic ${restriction.due_date && new Date(restriction.due_date) < new Date() && restriction.status !== 'Resolvida' ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                                            {restriction.due_date ? formatDate(restriction.due_date) : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setRestrictionModal({
                                                        taskId: viewingTaskRestrictions.taskId,
                                                        taskTitle: viewingTaskRestrictions.taskTitle,
                                                        taskStartDate: viewingTaskRestrictions.taskStartDate,
                                                        restriction
                                                    })}
                                                    className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-brand-accent hover:text-white transition-all shadow-lg"
                                                    title="Editar"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                {restriction.status !== 'Resolvida' && (
                                                    <button
                                                        onClick={async () => {
                                                            await onUpdateRestriction(restriction.id, { status: 'Resolvida' });
                                                            showToast('Restrição resolvida!', 'success');
                                                        }}
                                                        className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-500/20"
                                                        title="Resolver"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                            {restrictions.filter(r => String(r.baseline_task_id) === String(viewingTaskRestrictions.taskId)).length === 0 && (
                                <div className="text-center py-24 bg-white/5 rounded-[2.5rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center space-y-4">
                                    <div className="w-20 h-20 bg-brand-accent/10 rounded-full flex items-center justify-center text-brand-accent animate-pulse">
                                        <AlertIcon className="w-10 h-10 opacity-40" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-white text-lg font-black italic uppercase tracking-tighter">Campo Limpo</p>
                                        <p className="text-xs text-brand-med-gray font-bold tracking-wide">Esta atividade está livre para execução.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-black/20 border-t border-white/5 shrink-0">
                            <button
                                onClick={() => setRestrictionModal({
                                    taskId: viewingTaskRestrictions.taskId,
                                    taskTitle: viewingTaskRestrictions.taskTitle,
                                    taskStartDate: viewingTaskRestrictions.taskStartDate
                                })}
                                className="w-full py-5 bg-brand-accent text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(227,90,16,0.3)] hover:bg-[#e35a10] hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-4 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500 shadow-inner">
                                    <span className="text-xl">+</span>
                                </div>
                                Cadastrar Nova Restrição
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Restrições */}
            {restrictionModal && (
                <RestrictionModal
                    baselineTaskId={restrictionModal.taskId}
                    baselineTaskTitle={restrictionModal.taskTitle}
                    baselineTaskStartDate={restrictionModal.taskStartDate}
                    restriction={restrictionModal.restriction}
                    onClose={() => setRestrictionModal(null)}
                    onSave={async (restriction) => {
                        const result = await onSaveRestriction(restriction);
                        if (result.success) {
                            showToast('Restrição adicionada com sucesso!', 'success');
                            return { success: true };
                        } else {
                            showToast(`Erro ao adicionar restrição: ${result.error}`, 'error');
                            return { success: false, error: result.error };
                        }
                    }}
                    onUpdate={async (id, updates) => {
                        const result = await onUpdateRestriction(id, updates);
                        if (result.success) {
                            showToast('Restrição atualizada com sucesso!', 'success');
                            return { success: true };
                        } else {
                            showToast(`Erro ao atualizar restrição: ${result.error}`, 'error');
                            return { success: false, error: result.error };
                        }
                    }}
                />
            )}
        </div>
    );
};

export default LeanPage;
