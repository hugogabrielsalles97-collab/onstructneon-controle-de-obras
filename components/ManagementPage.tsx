import React, { useMemo } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import { Task, TaskStatus } from '../types';
import ManagementIcon from './icons/ManagementIcon';
import PpcChart from './PpcChart';
import CumulativeProgressChart from './CumulativeProgressChart';
import Sidebar from './Sidebar';

interface ManagementPageProps {
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
    onNavigateToHome?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const ManagementPage: React.FC<ManagementPageProps> = ({
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
    onNavigateToHome,
    onUpgradeClick,
    showToast
}) => {
    const { currentUser: user, tasks, currentScheduleTasks, signOut, cutOffDateStr } = useData();
    const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>(['Concluída', 'Em Andamento', 'Não Iniciada', 'Atrasada']);
    const [dateFilters, setDateFilters] = React.useState({ startDate: '', endDate: '' });

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    const toggleStatus = (status: string) => {
        setSelectedStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const analysisData = useMemo(() => {
        const today = new Date();
        const cutOffDate = new Date(cutOffDateStr + 'T00:00:00Z');

        return currentScheduleTasks
            .filter(bt => {
                if (!dateFilters.startDate && !dateFilters.endDate) return true;
                const btDate = new Date(bt.dueDate);
                const start = dateFilters.startDate ? new Date(dateFilters.startDate + 'T00:00:00Z') : null;
                const end = dateFilters.endDate ? new Date(dateFilters.endDate + 'T23:59:59Z') : null;

                if (start && btDate < start) return false;
                if (end && btDate > end) return false;
                return true;
            })
            .map(bt => {
                const linkedTasks = tasks.filter(t => String(t.baseline_id) === String(bt.id));

                const pStart = new Date(bt.startDate);
                const pEnd = new Date(bt.dueDate);
                const isItemBeforeCutoff = pEnd < cutOffDate;

                // Dates from Linked Tasks
                const actualStartDates = linkedTasks.map(t => t.actualStartDate).filter(Boolean) as string[];
                const actualEndDates = linkedTasks.map(t => t.actualEndDate).filter(Boolean) as string[];

                const firstActualStart = actualStartDates.length > 0
                    ? new Date(Math.min(...actualStartDates.map(d => new Date(d).getTime())))
                    : null;

                const lastActualEnd = actualEndDates.length > 0
                    ? new Date(Math.max(...actualEndDates.map(d => new Date(d).getTime())))
                    : null;

                // Progress Calculation
                const totalPlannedQty = Number(bt.quantity) || 0;
                const rawActualQty = linkedTasks.reduce((acc, t) => acc + (Number(t.actualQuantity) || 0), 0);

                let progressPercent = 0;
                if (isItemBeforeCutoff) {
                    progressPercent = 100;
                } else if (totalPlannedQty > 0) {
                    progressPercent = (rawActualQty / totalPlannedQty) * 100;
                } else if (linkedTasks.length > 0) {
                    // Fallback: Média de progresso se não houver quantidade planejada
                    const avgProgress = linkedTasks.reduce((acc, t) => acc + (Number(t.progress) || 0), 0) / linkedTasks.length;
                    progressPercent = avgProgress;
                }

                progressPercent = Math.min(100, Math.round(progressPercent));
                const isCompleted = progressPercent >= 100;

                // Planned vs Expected
                const totalPlannedDays = Math.max(1, (pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24));
                const daysElapsed = Math.max(0, (today.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24));
                const expectedProgress = Math.min(100, Math.max(0, (daysElapsed / totalPlannedDays) * 100));

                const idp = expectedProgress > 0 ? progressPercent / expectedProgress : 1;

                let projectedEndDate = null;
                if (isItemBeforeCutoff) {
                    projectedEndDate = pEnd;
                } else if (isCompleted && lastActualEnd) {
                    projectedEndDate = lastActualEnd;
                } else if (firstActualStart && progressPercent > 0 && progressPercent < 100) {
                    const msSinceStart = (today.getTime() - firstActualStart.getTime());
                    const msRemaining = (msSinceStart / progressPercent) * (100 - progressPercent);
                    projectedEndDate = new Date(today.getTime() + msRemaining);
                }

                const isDelayed = !isItemBeforeCutoff && today > pEnd && !isCompleted;
                const criticalRisk = !isItemBeforeCutoff && idp < 0.7 && !isCompleted && expectedProgress > 20;

                // Status Automatizado
                let currentStatus = 'Não Iniciada';
                if (isItemBeforeCutoff || isCompleted) {
                    currentStatus = 'Concluída';
                } else if (isDelayed || criticalRisk) {
                    currentStatus = 'Atrasada';
                } else if (progressPercent > 0 || firstActualStart || linkedTasks.some(t => t.status === TaskStatus.InProgress)) {
                    currentStatus = 'Em Andamento';
                }

                return {
                    baseline: bt,
                    tasks: linkedTasks,
                    isPastCutoff: isItemBeforeCutoff,
                    currentStatus,
                    stats: {
                        totalActualQty: isItemBeforeCutoff ? totalPlannedQty : rawActualQty,
                        progressPercent,
                        expectedProgress: Math.round(expectedProgress),
                        idp: Number(idp.toFixed(2)),
                        firstActualStart,
                        lastActualEnd,
                        projectedEndDate,
                        isDelayed,
                        criticalRisk,
                        isOverBudget: !isItemBeforeCutoff && rawActualQty > totalPlannedQty && totalPlannedQty > 0
                    }
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .filter(item => selectedStatuses.includes(item.currentStatus))
            .sort((a, b) => new Date(a.baseline.dueDate).getTime() - new Date(b.baseline.dueDate).getTime());
    }, [tasks, currentScheduleTasks, cutOffDateStr, selectedStatuses]);

    const globalStats = useMemo(() => {
        const total = analysisData.length;
        if (total === 0) return null;
        const avgProgress = analysisData.reduce((acc, item) => acc + item.stats.progressPercent, 0) / total;
        const delayedCount = analysisData.filter(item => item.stats.isDelayed || item.stats.criticalRisk).length;
        const completedCount = analysisData.filter(item => item.stats.progressPercent >= 100).length;

        return { avgProgress: Math.round(avgProgress), delayedCount, completedCount, total };
    }, [analysisData]);

    const formatDate = (date: string | Date | null) => {
        if (!date) return '-';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="management"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={() => { }}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToPodcast={onNavigateToPodcast}
                onUpgradeClick={onUpgradeClick}
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
                    onNavigateToAnalysis={() => { }}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="management"
                />

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 animate-slide-up animate-stagger-2">
                    <div className="max-w-screen-2xl mx-auto space-y-6">
                        <div className="flex justify-between items-start non-printable flex-wrap gap-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                    <ManagementIcon className="w-8 h-8 text-brand-accent" />
                                    <h2 className="text-2xl font-bold text-gray-100">Painel Gerencial</h2>
                                </div>
                                <p className="text-[10px] text-brand-med-gray uppercase font-bold tracking-widest ml-11">Controle de Cronograma</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 bg-brand-dark/50 p-3 rounded-lg border border-brand-darkest">
                                <div className="flex gap-2">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-brand-med-gray uppercase font-black mb-1">Início do Período</label>
                                        <input
                                            type="date"
                                            value={dateFilters.startDate}
                                            onChange={(e) => setDateFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                            className="bg-brand-darkest border border-brand-dark rounded text-[10px] p-1.5 text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-brand-med-gray uppercase font-black mb-1">Fim do Período</label>
                                        <input
                                            type="date"
                                            value={dateFilters.endDate}
                                            onChange={(e) => setDateFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                            className="bg-brand-darkest border border-brand-dark rounded text-[10px] p-1.5 text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col border-l border-brand-dark pl-4">
                                    <label className="text-[10px] text-brand-med-gray uppercase font-black mb-1">Filtro de Status</label>
                                    <div className="flex gap-1">
                                        {['Concluída', 'Em Andamento', 'Não Iniciada', 'Atrasada'].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => toggleStatus(s)}
                                                className={`px-2 py-1.5 text-[9px] font-bold rounded uppercase transition-colors border ${selectedStatuses.includes(s)
                                                    ? 'bg-brand-accent/20 border-brand-accent text-brand-accent'
                                                    : 'bg-brand-darkest border-brand-dark text-brand-med-gray hover:text-gray-300'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={onNavigateToDashboard}
                                    className="px-4 py-2 bg-brand-dark text-brand-med-gray rounded-md hover:bg-brand-dark/50 transition-colors flex items-center gap-2 border border-brand-darkest text-xs font-bold"
                                >
                                    &larr; Voltar
                                </button>
                            </div>
                        </div>

                        {/* Resumo Gerencial */}
                        {globalStats && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 non-printable">
                                <div className="bg-brand-dark/80 p-4 rounded-lg border border-brand-darkest shadow-lg">
                                    <p className="text-[10px] text-brand-med-gray uppercase font-bold">Itens Filtrados</p>
                                    <p className="text-3xl font-black text-white">{globalStats.total}</p>
                                </div>
                                <div className="bg-brand-dark/80 p-4 rounded-lg border border-brand-darkest shadow-lg">
                                    <p className="text-[10px] text-brand-med-gray uppercase font-bold">Progresso Médio</p>
                                    <p className="text-3xl font-black text-brand-accent">{globalStats.avgProgress}%</p>
                                    <div className="w-full bg-brand-darkest rounded-full h-1.5 mt-2">
                                        <div className="bg-brand-accent h-full rounded-full" style={{ width: `${globalStats.avgProgress}%` }}></div>
                                    </div>
                                </div>
                                <div className="bg-brand-dark/80 p-4 rounded-lg border border-brand-darkest shadow-lg">
                                    <p className="text-[10px] text-red-500 uppercase font-bold">Em Atraso</p>
                                    <p className="text-3xl font-black text-red-500">{globalStats.delayedCount}</p>
                                </div>
                                <div className="bg-brand-dark/80 p-4 rounded-lg border border-brand-darkest shadow-lg">
                                    <p className="text-[10px] text-green-500 uppercase font-bold">Concluídos</p>
                                    <p className="text-3xl font-black text-green-500">{globalStats.completedCount}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            {analysisData.length === 0 ? (
                                <div className="bg-brand-dark/70 p-12 rounded-lg text-center text-brand-med-gray">
                                    Nenhum item macro corresponde aos filtros selecionados.
                                </div>
                            ) : (
                                analysisData.map(({ baseline, tasks: linkedTasks, stats, isPastCutoff }) => {
                                    if (isPastCutoff) {
                                        return (
                                            <div key={baseline.id} className="bg-brand-dark/30 rounded-lg border border-green-500/20 p-4 flex justify-between items-center opacity-70">
                                                <div className="flex items-center gap-4">
                                                    <div className="px-2 py-3 bg-green-500/10 rounded flex flex-col justify-center items-center border border-green-500/20 min-w-[80px]">
                                                        <span className="text-[8px] text-green-400 uppercase font-black leading-none">Status</span>
                                                        <span className="text-[10px] text-green-500 font-black mt-1 uppercase">Finalizado</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-brand-med-gray font-mono text-[10px]">#{baseline.id}</span>
                                                            <span className="text-[9px] text-brand-med-gray uppercase">{baseline.location}</span>
                                                        </div>
                                                        <h3 className="text-base font-bold text-gray-300">{baseline.title}</h3>
                                                        <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest mt-1">✓ ITEM FINALIZADO</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-brand-med-gray uppercase">Fim Planejado</p>
                                                    <p className="text-sm font-mono text-gray-400 font-bold">{formatDate(baseline.dueDate)}</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={baseline.id} className={`bg-brand-dark/70 rounded-lg border shadow-xl overflow-hidden ${stats.criticalRisk ? 'border-red-500/50' : 'border-brand-darkest'}`}>
                                            {(stats.criticalRisk || stats.isDelayed) && (
                                                <div className="bg-red-500 text-white text-[10px] font-bold py-1 px-4 text-center uppercase tracking-widest animate-pulse">
                                                    {stats.criticalRisk ? '🚨 Alerta: Desempenho Crítico' : '⚠️ Atenção: Item com Atraso'}
                                                </div>
                                            )}

                                            <div className="p-5">
                                                <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="px-2 py-0.5 bg-brand-accent/20 text-brand-accent text-[10px] font-bold rounded uppercase">Item Macro</span>
                                                            <span className="text-brand-med-gray font-mono text-xs">#{baseline.id}</span>
                                                        </div>
                                                        <h3 className="text-xl font-bold text-white mt-1 leading-tight">{baseline.title}</h3>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-brand-med-gray">
                                                            <span>{baseline.discipline}</span>
                                                            <span>•</span>
                                                            <span>{baseline.level}</span>
                                                            <span>•</span>
                                                            <span className="text-brand-accent font-semibold">{baseline.location}</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-8 items-center border-l border-brand-dark pl-8">
                                                        <div className="text-center">
                                                            <p className="text-[10px] text-brand-med-gray uppercase">IDP (Prazo)</p>
                                                            <p className={`text-2xl font-black ${stats.idp >= 1 ? 'text-green-400' : stats.idp >= 0.8 ? 'text-yellow-400' : 'text-red-500'}`}>
                                                                {stats.idp}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-brand-med-gray uppercase">Avanço Real</p>
                                                            <p className="text-4xl font-black text-brand-accent">{stats.progressPercent}%</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                                    {/* Produção */}
                                                    <div className="bg-brand-darkest/40 p-4 rounded-lg border border-brand-darkest flex flex-col justify-between">
                                                        <h4 className="text-[10px] font-bold text-brand-med-gray uppercase tracking-widest mb-3">Produção</h4>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-brand-med-gray">Planejado:</span>
                                                                <span className="text-white font-bold">{baseline.quantity} {baseline.unit}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-brand-med-gray">Realizado:</span>
                                                                <span className={`font-bold ${stats.isOverBudget ? 'text-red-400' : 'text-green-400'}`}>{stats.totalActualQty} {baseline.unit}</span>
                                                            </div>
                                                            <div className="w-full bg-brand-darkest rounded-full h-3 relative mt-2 overflow-hidden border border-brand-dark">
                                                                <div className="bg-brand-accent h-full absolute transition-all duration-500" style={{ width: `${Math.min(100, stats.progressPercent)}%` }}></div>
                                                                <div className="bg-white/10 h-full absolute border-r border-white/50" style={{ width: `${stats.expectedProgress}%` }}></div>
                                                            </div>
                                                            <div className="flex justify-between text-[8px] text-brand-med-gray">
                                                                <span>Progresso: {stats.progressPercent}%</span>
                                                                <span>Esperado: {stats.expectedProgress}%</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Cronograma de Datas */}
                                                    <div className="bg-brand-darkest/40 p-4 rounded-lg border border-brand-darkest">
                                                        <h4 className="text-[10px] font-bold text-brand-med-gray uppercase tracking-widest mb-3">Datas e Prazos</h4>
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                <div className="bg-brand-dark/50 p-2 rounded">
                                                                    <p className="text-brand-med-gray uppercase leading-none mb-1">Início Plan.</p>
                                                                    <p className="text-gray-300 font-bold">{formatDate(baseline.startDate)}</p>
                                                                </div>
                                                                <div className="bg-brand-dark/50 p-2 rounded">
                                                                    <p className="text-brand-med-gray uppercase leading-none mb-1">Fim Plan.</p>
                                                                    <p className="text-gray-300 font-bold">{formatDate(baseline.dueDate)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                <div className="bg-brand-dark/80 p-2 rounded border border-brand-accent/10">
                                                                    <p className="text-brand-accent uppercase leading-none mb-1">Início Real</p>
                                                                    <p className="text-white font-bold">{formatDate(stats.firstActualStart)}</p>
                                                                </div>
                                                                <div className="bg-brand-dark/80 p-2 rounded border border-brand-accent/10">
                                                                    <p className="text-brand-accent uppercase leading-none mb-1">Projeção/Fim</p>
                                                                    <p className={`text-white font-bold ${stats.isDelayed ? 'text-red-400' : 'text-cyan-400'}`}>
                                                                        {stats.progressPercent >= 100 ? formatDate(stats.lastActualEnd) : formatDate(stats.projectedEndDate)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Detalhamento de Avanço (Tarefas Vinculadas) */}
                                                    <div className="bg-brand-darkest/40 p-4 rounded-lg border border-brand-darkest flex flex-col">
                                                        <h4 className="text-[10px] font-bold text-brand-med-gray uppercase tracking-widest mb-3">Avanço das Vinculadas ({linkedTasks.length})</h4>
                                                        <div className="flex-1 overflow-y-auto max-h-[100px] space-y-2 pr-2 custom-scrollbar">
                                                            {linkedTasks.length === 0 ? (
                                                                <p className="text-[10px] text-brand-med-gray italic">Sem tarefas vinculadas.</p>
                                                            ) : (
                                                                linkedTasks.map(t => (
                                                                    <div key={t.id} className="text-[10px] bg-brand-dark/50 p-2 rounded flex flex-col gap-1 border border-brand-darkest/50">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-gray-200 truncate font-bold">{t.title}</span>
                                                                            <span className="text-brand-accent font-black">{t.progress}%</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-[8px] text-brand-med-gray font-mono">
                                                                            <span>{formatDate(t.actualStartDate)}</span>
                                                                            <span>{formatDate(t.actualEndDate)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Diagnóstico Gerencial */}
                                                    <div className="bg-brand-accent/10 p-4 rounded-lg border border-brand-accent/30 flex flex-col">
                                                        <h4 className="text-[10px] font-bold text-brand-accent uppercase tracking-widest mb-3">Diagnóstico Gerencial</h4>
                                                        <div className="flex-1 text-xs text-gray-300 space-y-2">
                                                            {stats.progressPercent >= 100 ? (
                                                                <p className="text-green-400 font-bold">✅ Item concluído.</p>
                                                            ) : stats.criticalRisk ? (
                                                                <p className="text-red-400 font-bold">🆘 Ritmo crítico. Necessário intervenção (IDP {stats.idp}).</p>
                                                            ) : stats.idp < 1 ? (
                                                                <p className="text-yellow-400 font-bold">⚠️ Atraso moderado detectado.</p>
                                                            ) : (
                                                                <p className="text-cyan-400 font-bold">🚀 Execução conforme planejado.</p>
                                                            )}
                                                            <p className="text-[9px] text-brand-med-gray italic">Informações atualizadas em tempo real conforme as tarefas vinculadas são preenchidas.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ManagementPage;
