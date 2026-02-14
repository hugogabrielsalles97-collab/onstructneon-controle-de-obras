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
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
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
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToRestrictions,
    onSaveRestriction,
    onUpdateRestriction,
    onDeleteRestriction,
    restrictions,
    onUpgradeClick,
    showToast
}) => {
    const { currentUser: user, tasks, baselineTasks, cutOffDateStr, signOut } = useData();
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

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    // Cálculos de Período (Lookahead de 1 semana a frente + atual)
    const lookaheadData = useMemo(() => {
        const today = new Date();
        const startOfCurrentWeek = new Date(today);
        startOfCurrentWeek.setDate(today.getDate() - today.getDay());
        startOfCurrentWeek.setHours(0, 0, 0, 0);

        const endOfLookahead = new Date(startOfCurrentWeek);
        endOfLookahead.setDate(startOfCurrentWeek.getDate() + (lookaheadWeeks * 7 + 6)); // Atual + N semanas de Lookahead
        endOfLookahead.setHours(23, 59, 59, 999);

        const filtered = baselineTasks.filter(bt => {
            const btStart = new Date(bt.startDate);
            const btEnd = new Date(bt.dueDate);

            // Atividade intercepta o período (Hoje até Fim do Lookahead)
            return (btStart <= endOfLookahead && btEnd >= today) ||
                (btEnd >= today && btEnd <= endOfLookahead);
        }).map(bt => {
            const linkedTasks = tasks.filter(t => String(t.baseline_id) === String(bt.id));
            const totalPlannedQty = Number(bt.quantity) || 0;
            const rawActualQty = linkedTasks.reduce((acc, t) => acc + (Number(t.actualQuantity) || 0), 0);

            let progress = 0;
            if (totalPlannedQty > 0) progress = Math.min(100, (rawActualQty / totalPlannedQty) * 100);
            else if (linkedTasks.length > 0) progress = linkedTasks.reduce((acc, t) => acc + (Number(t.progress) || 0), 0) / linkedTasks.length;

            const isNextWeek = new Date(bt.dueDate) > new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

            return {
                ...bt,
                currentProgress: Math.round(progress),
                linkedTasks,
                isNextWeek,
                status: progress >= 100 ? 'Pronto' : progress > 0 ? 'Em Fluxo' : 'Planejado'
            };
        });

        const cutOffDate = new Date(cutOffDateStr);
        cutOffDate.setHours(0, 0, 0, 0);

        const currentWeekTasks = filtered.filter(t => {
            const startDate = new Date(t.startDate);
            // Se começou antes ou na data de corte, ou se vence na semana atual
            return startDate <= cutOffDate || !t.isNextWeek;
        });

        const nextWeekTasks = filtered.filter(t => {
            const startDate = new Date(t.startDate);
            // Apenas o que começa estritamente após a data de corte E é uma tarefa futura
            return startDate > cutOffDate && t.isNextWeek;
        });

        const impactedRestrictionsCount = restrictions.filter(r => {
            if (!r.due_date || r.status === 'Resolvida') return false;
            const task = baselineTasks.find(t => String(t.id) === String(r.baseline_task_id));
            if (!task) return false;

            // Lógica de Impacto: Data limite > (Início da Tarefa - 2 dias)
            const startDate = new Date(task.startDate);
            const impactLimit = new Date(startDate);
            impactLimit.setDate(startDate.getDate() - 2);

            return new Date(r.due_date) > impactLimit;
        }).length;

        return {
            currentWeekTasks,
            nextWeekTasks,
            totalActive: filtered.length,
            impactedRestrictionsCount
        };
    }, [baselineTasks, tasks, restrictions, lookaheadWeeks, cutOffDateStr]);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    // Função para obter a cor do botão de restrições do header
    const getHeaderRestrictionButtonColor = () => {
        const activeRestrictions = restrictions.filter(r => r.status !== 'Resolvida');

        if (activeRestrictions.length === 0) {
            // Sem restrições: verde (sucesso)
            return 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30';
        }

        // Verificar se há restrições críticas
        const hasCritical = activeRestrictions.some(r => r.priority === 'Crítica');
        if (hasCritical) {
            return 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30';
        }

        // Verificar se há restrições de alta prioridade
        const hasHigh = activeRestrictions.some(r => r.priority === 'Alta');
        if (hasHigh) {
            return 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30';
        }

        // Verificar se há restrições de média prioridade
        const hasMedium = activeRestrictions.some(r => r.priority === 'Média');
        if (hasMedium) {
            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30';
        }

        // Apenas restrições de baixa prioridade
        return 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30';
    };

    // Função para obter a cor do botão de restrição baseada na prioridade mais alta da TAREFA
    const getTaskRestrictionButtonColor = (taskId: string) => {
        const taskRestrictions = restrictions.filter(r => String(r.baseline_task_id) === String(taskId) && r.status !== 'Resolvida');

        if (taskRestrictions.length === 0) {
            return 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30';
        }

        const hasCritical = taskRestrictions.some(r => r.priority === 'Crítica');
        if (hasCritical) return 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30';

        const hasHigh = taskRestrictions.some(r => r.priority === 'Alta');
        if (hasHigh) return 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30';

        const hasMedium = taskRestrictions.some(r => r.priority === 'Média');
        if (hasMedium) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30';

        return 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30';
    };

    return (
        <div className="flex flex-col h-screen">
            <Header
                user={user}
                onLogout={handleLogout}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={() => { }}
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
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-bold border ${lookaheadData.impactedRestrictionsCount > 0 ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse' : getHeaderRestrictionButtonColor()}`}
                            >
                                <AlertIcon className="w-5 h-5" />
                                <span>{lookaheadData.impactedRestrictionsCount > 0 ? 'ALERTA DE PRAZO' : 'Restrições'}</span>
                                {restrictions.filter(r => r.status !== 'Resolvida').length > 0 && (
                                    <span className="px-2 py-0.5 bg-white/20 text-white rounded-full text-xs font-black">
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
                                <span className="text-4xl font-black text-white">{lookaheadData.totalActive}</span>
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
                                </select>
                            </div>
                            <p className="text-[11px] text-brand-med-gray mt-4 leading-relaxed">
                                Liberação de frentes para os próximos {lookaheadWeeks * 7} dias.
                            </p>
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
                                {lookaheadData.currentWeekTasks.length === 0 ? (
                                    <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-brand-med-gray text-sm">
                                        Nenhuma atividade planejada para finalização esta semana.
                                    </div>
                                ) : (
                                    lookaheadData.currentWeekTasks.map(task => (
                                        <div key={task.id} className="bg-[#111827] border border-white/5 rounded-xl p-4 hover:border-brand-accent/30 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-brand-accent uppercase bg-brand-accent/10 px-1.5 py-0.5 rounded">#{task.id}</span>
                                                        <span className="text-[10px] text-brand-med-gray uppercase font-bold">
                                                            {task.location}
                                                            {task.level && task.level !== '-' && ` • ${task.level}`}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-100">{task.title}</h4>
                                                    <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${task.currentProgress >= 100 ? 'bg-green-500' : 'bg-brand-accent'}`}
                                                            style={{ width: `${task.currentProgress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col gap-2">
                                                    <div>
                                                        <span className={`text-[10px] font-black uppercase ${task.currentProgress >= 100 ? 'text-green-500' : 'text-yellow-500'}`}>
                                                            {task.currentProgress}%
                                                        </span>
                                                        <p className="text-[9px] text-brand-med-gray font-mono mt-0.5">FIM: {formatDate(task.dueDate)}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setViewingTaskRestrictions({ taskId: task.id, taskTitle: task.title, taskStartDate: task.startDate })}
                                                        className={`px-3 py-1.5 rounded-lg transition-all font-bold text-xs border flex items-center gap-1.5 ${getTaskRestrictionButtonColor(task.id)}`}
                                                    >
                                                        <AlertIcon className="w-3.5 h-3.5" />
                                                        Restrição
                                                        {restrictions.filter(r => String(r.baseline_task_id) === String(task.id) && r.status !== 'Resolvida').length > 0 && (
                                                            <span className="px-1.5 py-0.5 bg-white/20 text-white rounded-full text-[9px] font-black">
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

                        {/* Lookahead - O QUE VOU FAZER? */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Horizonte 2 Semanas (Lookahead)</h3>
                            </div>
                            <div className="space-y-3">
                                {lookaheadData.nextWeekTasks.length === 0 ? (
                                    <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-brand-med-gray text-sm">
                                        Monitorando o horizonte... Sem tarefas planejadas para as próximas 2 semanas.
                                    </div>
                                ) : (
                                    lookaheadData.nextWeekTasks.map(task => (
                                        <div key={task.id} className="bg-[#111827]/60 border border-white/5 rounded-xl p-4 hover:border-purple-500/30 transition-all opacity-80 hover:opacity-100">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-purple-400 uppercase bg-purple-400/10 px-1.5 py-0.5 rounded">#{task.id}</span>
                                                        <span className="text-[10px] text-brand-med-gray uppercase font-bold">
                                                            {task.location}
                                                            {task.level && task.level !== '-' && ` • ${task.level}`}
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
                                                        className={`px-3 py-1.5 rounded-lg transition-all font-bold text-xs border flex items-center gap-1.5 ${getTaskRestrictionButtonColor(task.id)}`}
                                                    >
                                                        <AlertIcon className="w-3.5 h-3.5" />
                                                        Restrição
                                                        {restrictions.filter(r => String(r.baseline_task_id) === String(task.id) && r.status !== 'Resolvida').length > 0 && (
                                                            <span className="px-1.5 py-0.5 bg-white/20 text-white rounded-full text-[9px] font-black">
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

            {/* Modal de Gerenciamento de Restrições da Tarefa */}
            {viewingTaskRestrictions && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4">
                    <div className="bg-[#111827] rounded-3xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-brand-darkest">
                            <div>
                                <h2 className="text-xl font-black text-white">Restrições da Atividade</h2>
                                <p className="text-xs text-brand-med-gray mt-1 font-bold">
                                    TAREFA: <span className="text-brand-accent">{viewingTaskRestrictions.taskTitle}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setViewingTaskRestrictions(null)}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
                            >
                                <ClearIcon className="w-5 h-5 text-brand-med-gray group-hover:text-white" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-brand-darkest/30">
                            {restrictions
                                .filter(r => String(r.baseline_task_id) === String(viewingTaskRestrictions.taskId))
                                .sort((a, b) => {
                                    if (a.status === 'Resolvida' && b.status !== 'Resolvida') return 1;
                                    if (a.status !== 'Resolvida' && b.status === 'Resolvida') return -1;
                                    return 0;
                                })
                                .map(restriction => (
                                    <div key={restriction.id} className={`p-5 rounded-2xl border transition-all ${restriction.status === 'Resolvida' ? 'bg-green-500/5 border-green-500/20 opacity-70' : 'bg-[#1a2232] border-white/5 shadow-lg'}`}>
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${restriction.priority === 'Crítica' ? 'bg-red-500 text-white' :
                                                        restriction.priority === 'Alta' ? 'bg-orange-500 text-white' :
                                                            restriction.priority === 'Média' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                                                'bg-green-500/20 text-green-500 border border-green-500/30'
                                                        }`}>
                                                        {restriction.priority}
                                                    </span>
                                                    <span className="text-[10px] text-brand-med-gray font-black uppercase opacity-60">/</span>
                                                    <span className="text-[10px] text-brand-accent font-black uppercase tracking-wider">{restriction.type}</span>
                                                    {restriction.status === 'Resolvida' && (
                                                        <span className="text-[9px] font-black text-green-400 uppercase bg-green-400/10 px-2 py-0.5 rounded ml-2">Resolvida</span>
                                                    )}
                                                </div>
                                                <p className={`text-sm leading-relaxed ${restriction.status === 'Resolvida' ? 'text-gray-500 line-through italic' : 'text-gray-200'}`}>
                                                    {restriction.description}
                                                </p>
                                                <div className="mt-4 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-widest mb-1">Responsável</p>
                                                        <p className="text-xs text-gray-300 font-bold">{restriction.responsible} {restriction.department && <span className="text-brand-med-gray opacity-60 ml-1 font-normal">| {restriction.department}</span>}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-widest mb-1">Data Limite</p>
                                                        <p className={`text-xs font-bold ${restriction.due_date && new Date(restriction.due_date) < new Date() && restriction.status !== 'Resolvida' ? 'text-red-400' : 'text-gray-300'}`}>
                                                            {restriction.due_date ? formatDate(restriction.due_date) : '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0">
                                                <button
                                                    onClick={() => setRestrictionModal({
                                                        taskId: viewingTaskRestrictions.taskId,
                                                        taskTitle: viewingTaskRestrictions.taskTitle,
                                                        taskStartDate: viewingTaskRestrictions.taskStartDate,
                                                        restriction
                                                    })}
                                                    className="p-2 bg-white/5 text-brand-med-gray rounded-lg hover:bg-white/10 hover:text-white transition-all border border-white/5"
                                                    title="Editar"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                {restriction.status !== 'Resolvida' && (
                                                    <button
                                                        onClick={async () => {
                                                            await onUpdateRestriction(restriction.id, { status: 'Resolvida' });
                                                            showToast('Restrição marcada como resolvida!', 'success');
                                                        }}
                                                        className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-all border border-green-500/20"
                                                        title="Marcar como Resolvida"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                            {restrictions.filter(r => String(r.baseline_task_id) === String(viewingTaskRestrictions.taskId)).length === 0 && (
                                <div className="text-center py-16 bg-white/5 rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 text-brand-med-gray">
                                        <AlertIcon className="w-6 h-6 opacity-30" />
                                    </div>
                                    <p className="text-brand-med-gray text-sm font-bold">Nenhuma restrição cadastrada.</p>
                                    <p className="text-[11px] text-brand-med-gray opacity-60 mt-1">Esta atividade está livre para execução.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/10 bg-brand-darkest">
                            <button
                                onClick={() => setRestrictionModal({
                                    taskId: viewingTaskRestrictions.taskId,
                                    taskTitle: viewingTaskRestrictions.taskTitle,
                                    taskStartDate: viewingTaskRestrictions.taskStartDate
                                })}
                                className="w-full py-4 bg-brand-accent text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#e35a10] transition-all shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-3 group"
                            >
                                <span className="text-lg group-hover:scale-125 transition-transform">+</span>
                                <span>Cadastrar Nova Restrição</span>
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
