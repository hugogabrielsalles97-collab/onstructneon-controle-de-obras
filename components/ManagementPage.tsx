import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import { Task, TaskStatus } from '../types';
import ManagementIcon from './icons/ManagementIcon';
import ExcelIcon from './icons/ExcelIcon';
import PpcChart from './PpcChart';
import XIcon from './icons/XIcon';
import InfoIcon from './icons/InfoIcon';
import CumulativeProgressChart from './CumulativeProgressChart';
import Sidebar from './Sidebar';
import { exportTasksToExcel } from '../utils/excelExport';
import ManagementMonthlyProgress from './ManagementMonthlyProgress';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Line, ComposedChart, Cell, LabelList 
} from 'recharts';
import AlertIcon from './icons/AlertIcon';

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
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToCheckoutSummary?: () => void;
    onNavigateToOrgSummary?: () => void;
    onNavigateToTeams?: () => void;
    onUpgradeClick: () => void;
    onAddTask?: () => void;
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
    onNavigateToOrgChart,
    onNavigateToOrgSummary,
    onNavigateToVisualControl,
    onNavigateToCheckoutSummary,
    onNavigateToTeams,
    onAddTask,
    showToast
}) => {
    const { 
        currentUser: user, 
        tasks, 
        currentScheduleTasks, 
        signOut, 
        currentScheduleCutOffDateStr,
        monthlyPlanning,
        setMonthlyPlanning,
        saveTask
    } = useData();
    const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>(['Concluída', 'Em Andamento', 'Não Iniciada', 'Atrasada']);
    const [dateFilters, setDateFilters] = React.useState({ startDate: '', endDate: '' });
    const [selectedImpactCategory, setSelectedImpactCategory] = React.useState<string | null>(null);
    const [editingImpactTaskId, setEditingImpactTaskId] = React.useState<string | null>(null);
    const [savingImpactTaskId, setSavingImpactTaskId] = React.useState<string | null>(null);

    const IMPACT_CATEGORIES = ['Projeto', 'Mão de obra', 'Equipamento', 'Acesso', 'Chuva', 'Inspeção', 'Material', 'Predecessora', 'Interferências'];
    const canEditImpact = user && (user.role === 'Master' || user.role === 'Planejador');

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
        const cutOffDate = new Date(currentScheduleCutOffDateStr + 'T00:00:00Z');

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
    }, [tasks, currentScheduleTasks, currentScheduleCutOffDateStr, selectedStatuses, dateFilters]);

    const paretoData = useMemo(() => {
        const counts: Record<string, number> = {
            'Projeto': 0,
            'Mão de obra': 0,
            'Equipamento': 0,
            'Acesso': 0,
            'Chuva': 0,
            'Inspeção': 0,
            'Material': 0,
            'Predecessora': 0,
            'Interferências': 0
        };

        tasks.forEach(t => {
            const obs = t.observations || '';
            Object.keys(counts).forEach(cat => {
                if (obs.includes(`[${cat}]`)) {
                    counts[cat]++;
                }
            });
        });

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1]);

        const total = sorted.reduce((acc, [_, count]) => acc + count, 0);
        let cumulative = 0;

        return sorted.map(([label, count]) => {
            cumulative += count;
            const cumulativePercent = total > 0 ? (cumulative / total) * 100 : 0;
            
            let abc = 'C';
            if (cumulativePercent <= 80) abc = 'A';
            else if (cumulativePercent <= 95) abc = 'B';

            return {
                label,
                count,
                cumulativePercent: Math.round(cumulativePercent),
                abc
            };
        });
    }, [tasks]);

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
                onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToOrgSummary={onNavigateToOrgSummary}
                onNavigateToVisualControl={onNavigateToVisualControl}
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
                    onNavigateToAnalysis={() => { }}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={onNavigateToOrgChart}
                    onNavigateToOrgSummary={onNavigateToOrgSummary}
                    onNavigateToVisualControl={onNavigateToVisualControl}
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

                        {/* Gráfico de Pareto de Impactos (6M) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 non-printable">
                            <div className="lg:col-span-2 bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl hover-shine relative overflow-hidden group">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2">Causa de não cumprimento</h4>
                                        <p className="text-[9px] text-brand-med-gray mt-2 italic">Identificação dos principais ofensores do cronograma</p>
                                    </div>
                                </div>
                                <div className="h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={paretoData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                            <defs>
                                                {/* Gradiente para Categoria A (Crítico/Laranja) */}
                                                <linearGradient id="gradientA" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.9}/>
                                                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.6}/>
                                                </linearGradient>
                                                {/* Gradiente para Categoria B (Intermediário/Azul) */}
                                                <linearGradient id="gradientB" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.6}/>
                                                </linearGradient>
                                                {/* Gradiente para Categoria C (Menor/Cinza) */}
                                                <linearGradient id="gradientC" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.9}/>
                                                    <stop offset="100%" stopColor="#475569" stopOpacity={0.6}/>
                                                </linearGradient>
                                                
                                                {/* Filtro de brilho para a linha */}
                                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                                </filter>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <XAxis 
                                                dataKey="label" 
                                                stroke="#475569" 
                                                fontSize={10} 
                                                fontWeight={700}
                                                tickLine={false}
                                                axisLine={false}
                                                dy={10}
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                stroke="#475569" 
                                                fontSize={10} 
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${value}`}
                                            />
                                            <YAxis 
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#94a3b8" 
                                                fontSize={10} 
                                                tickLine={false}
                                                axisLine={false}
                                                unit="%"
                                                domain={[0, 100]}
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#111827', 
                                                    border: '1px solid #ffffff10', 
                                                    borderRadius: '16px', 
                                                    fontSize: '11px',
                                                    backdropFilter: 'blur(8px)',
                                                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)'
                                                }}
                                                itemStyle={{ fontWeight: 'bold' }}
                                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                            />
                                            <Bar 
                                                yAxisId="left" 
                                                dataKey="count" 
                                                radius={[6, 6, 2, 2]} 
                                                barSize={44}
                                            >
                                                {paretoData.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={entry.abc === 'A' ? 'url(#gradientA)' : entry.abc === 'B' ? 'url(#gradientB)' : 'url(#gradientC)'} 
                                                    />
                                                ))}
                                                <LabelList 
                                                    dataKey="count" 
                                                    position="top" 
                                                    fill="#94a3b8" 
                                                    fontSize={11} 
                                                    fontWeight={900} 
                                                    offset={8}
                                                />
                                            </Bar>
                                            <Line 
                                                yAxisId="right"
                                                type="monotone" 
                                                dataKey="cumulativePercent" 
                                                stroke="#fb7185" 
                                                strokeWidth={4}
                                                dot={{ fill: '#fb7185', strokeWidth: 2, r: 5, stroke: '#111827' }}
                                                activeDot={{ r: 8, strokeWidth: 0 }}
                                                filter="url(#glow)"
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col">
                                <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2 mb-6">Classificação por Impacto</h4>
                                <div className="space-y-4 flex-1">
                                    {paretoData.map((item, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => setSelectedImpactCategory(item.label)}
                                            className="w-full flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 group hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    item.abc === 'A' ? 'bg-red-500/10 text-red-500' : 
                                                    item.abc === 'B' ? 'bg-blue-500/10 text-blue-500' : 
                                                    'bg-gray-500/10 text-gray-500'
                                                }`}>
                                                    {idx === 0 && <AlertIcon className="w-5 h-5" />}
                                                    {idx > 0 && <InfoIcon className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white group-hover:text-brand-accent transition-colors uppercase tracking-tight">{item.label}</p>
                                                    <p className="text-[10px] text-brand-med-gray font-bold">{item.count} ocorrências identificadas</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-white">{item.cumulativePercent}%</p>
                                                <p className="text-[8px] text-brand-med-gray uppercase font-bold">Acumulado</p>
                                            </div>
                                        </button>
                                    ))}
                                    {paretoData.reduce((acc, i) => acc + i.count, 0) === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-30">
                                            <AlertIcon className="w-8 h-8" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">Sem dados de impacto registrados nas tarefas.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5 text-[9px] text-brand-med-gray font-medium italic">
                                    Tip: A classe A representa os 80% dos problemas que devem ser atacados prioritariamente.
                                </div>
                            </div>
                        </div>

                        {/* Planejamento Mensal e Curva S */}
                        <ManagementMonthlyProgress 
                            data={monthlyPlanning}
                            onSave={setMonthlyPlanning}
                        />

                        {/* Performance por Responsável */}
                        {(() => {
                            const todayNum = new Date().setHours(0, 0, 0, 0);
                            const assigneeMap: { [key: string]: { total: number; onTime: number; late: number; overdue: number; open: number } } = {};

                            tasks.forEach(task => {
                                const assignee = task.assignee || 'Sem Responsável';
                                if (!assigneeMap[assignee]) assigneeMap[assignee] = { total: 0, onTime: 0, late: 0, overdue: 0, open: 0 };
                                assigneeMap[assignee].total++;

                                if (task.status === TaskStatus.Completed) {
                                    // Verificar se concluiu dentro do prazo
                                    if (task.actualEndDate && task.dueDate) {
                                        const actualEnd = new Date(task.actualEndDate + 'T00:00:00').getTime();
                                        const dueLimit = new Date(task.dueDate + 'T23:59:59').getTime();
                                        if (actualEnd <= dueLimit) {
                                            assigneeMap[assignee].onTime++;
                                        } else {
                                            assigneeMap[assignee].late++;
                                        }
                                    } else {
                                        // Concluída sem data real de fim — considerar no prazo
                                        assigneeMap[assignee].onTime++;
                                    }
                                } else if (new Date(task.dueDate + 'T00:00:00').getTime() < todayNum) {
                                    assigneeMap[assignee].overdue++;
                                } else {
                                    assigneeMap[assignee].open++;
                                }
                            });

                            const performanceData = Object.entries(assigneeMap)
                                .map(([name, stats]) => {
                                    // Taxa baseada em tarefas que já deveriam ter resultado:
                                    // concluídas (no prazo + fora do prazo) + atrasadas (nem concluiu)
                                    const resolved = stats.onTime + stats.late + stats.overdue;
                                    const onTimeRate = resolved > 0 ? Math.round((stats.onTime / resolved) * 100) : (stats.open > 0 ? 100 : 0);
                                    return {
                                        name: name.length > 20 ? name.substring(0, 20) + '…' : name,
                                        fullName: name,
                                        noPrazo: stats.onTime,
                                        foraDoPrazo: stats.late,
                                        emAberto: stats.open,
                                        atrasadas: stats.overdue,
                                        total: stats.total,
                                        totalCompleted: stats.onTime + stats.late,
                                        resolved,
                                        onTimeRate,
                                    };
                                })
                                .filter(item => item.resolved > 0 || item.total >= 3) // Mostra só quem tem relevância
                                .sort((a, b) => b.onTimeRate - a.onTimeRate || a.atrasadas - b.atrasadas || b.noPrazo - a.noPrazo)
                                .slice(0, 12);

                            if (performanceData.length === 0) return null;

                            return (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 non-printable">
                                    {/* Gráfico de Barras */}
                                    <div className="lg:col-span-2 bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl hover-shine relative overflow-hidden">
                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2">Performance por Responsável</h4>
                                                <p className="text-[9px] text-brand-med-gray mt-2 italic">Ranking por atividades cumpridas dentro do prazo</p>
                                            </div>
                                            <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider">
                                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div><span className="text-green-400">No Prazo</span></div>
                                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div><span className="text-yellow-400">Fora do Prazo</span></div>
                                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-blue-400">Em Aberto</span></div>
                                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-red-400">Atrasadas</span></div>
                                            </div>
                                        </div>
                                        <div className="h-[400px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={performanceData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                                                    <XAxis type="number" stroke="#94a3b8" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} />
                                                    <YAxis type="category" dataKey="name" width={140} stroke="#94a3b8" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '11px' }}
                                                        itemStyle={{ fontWeight: 'bold' }}
                                                        formatter={(value: any, name: string) => {
                                                            const labels: Record<string, string> = { noPrazo: 'No Prazo', foraDoPrazo: 'Fora do Prazo', emAberto: 'Em Aberto', atrasadas: 'Atrasadas' };
                                                            return [value, labels[name] || name];
                                                        }}
                                                    />
                                                    <Bar dataKey="noPrazo" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                                    <Bar dataKey="foraDoPrazo" stackId="a" fill="#eab308" />
                                                    <Bar dataKey="emAberto" stackId="a" fill="#3b82f6" />
                                                    <Bar dataKey="atrasadas" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Ranking Tabela */}
                                    <div className="bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl flex flex-col">
                                        <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2 mb-4">🏆 Ranking — No Prazo</h4>
                                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                                            {performanceData.map((item, idx) => {
                                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`;
                                                const barColor = item.onTimeRate >= 80 ? 'bg-green-500' : item.onTimeRate >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                                return (
                                                    <div key={item.fullName} className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-brand-accent/20 transition-all">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base">{medal}</span>
                                                                <span className="text-xs font-bold text-white truncate max-w-[120px]">{item.fullName}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`text-lg font-black ${item.onTimeRate >= 80 ? 'text-green-400' : item.onTimeRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{item.onTimeRate}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-full bg-brand-darkest rounded-full h-1.5 overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${item.onTimeRate}%` }}></div>
                                                        </div>
                                                        <div className="flex justify-between mt-1.5 text-[8px] text-brand-med-gray font-bold uppercase">
                                                            <span>✅ {item.noPrazo}/{item.resolved} no prazo</span>
                                                            <span>{item.atrasadas > 0 ? `🔴 ${item.atrasadas} atrasadas` : '🟢 0 atrasadas'}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-brand-med-gray font-medium italic">
                                            Critério: entregas no prazo ÷ (concluídas + atrasadas). Tarefas em aberto não penalizam.
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

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

            {/* Modal de Detalhamento de Impactos (Drill-down) */}
            {selectedImpactCategory && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedImpactCategory(null)}>
                    <div 
                        className="bg-[#0a0f18] border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-white/5 bg-brand-accent/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <span className="text-brand-accent">Detalhamento:</span> {selectedImpactCategory}
                                </h3>
                                <p className="text-xs text-brand-med-gray mt-1">Listagem de todas as tarefas que reportaram este impacto no cronograma.</p>
                            </div>
                            <button onClick={() => setSelectedImpactCategory(null)} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all border border-white/10 group">
                                <XIcon className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                            {tasks.filter(t => (t.observations || '').includes(`[${selectedImpactCategory}]`)).length === 0 ? (
                                <div className="text-center py-20 opacity-30">
                                    <p className="text-sm font-bold uppercase tracking-widest">Nenhuma tarefa encontrada com este marcador.</p>
                                </div>
                            ) : (
                                tasks.filter(t => (t.observations || '').includes(`[${selectedImpactCategory}]`)).map(t => (
                                    <div key={t.id} className={`bg-brand-dark/40 border rounded-2xl p-6 transition-all group shadow-inner ${savingImpactTaskId === t.id ? 'border-yellow-500/30 opacity-70' : 'border-white/5 hover:border-brand-accent/30'}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="px-2 py-0.5 bg-brand-accent text-white text-[9px] font-black rounded uppercase">{t.location || 'Local Não Informado'}</span>
                                                    <span className="text-[10px] text-brand-med-gray font-bold uppercase tracking-widest">{t.discipline}</span>
                                                </div>
                                                <h4 className="text-lg font-bold text-white group-hover:text-brand-accent transition-colors">{t.title}</h4>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="text-right">
                                                    <p className="text-[10px] text-brand-med-gray uppercase font-black">Avanço</p>
                                                    <p className="text-xl font-black text-white">{t.progress}%</p>
                                                </div>
                                                {/* Ações de edição/exclusão para Master e Planejador */}
                                                {canEditImpact && (
                                                    <div className="flex items-center gap-2 ml-2">
                                                        {editingImpactTaskId === t.id ? (
                                                            <div className="flex flex-col gap-2 bg-[#0a0f18] border border-brand-accent/30 rounded-xl p-3 shadow-2xl min-w-[180px] animate-scale-in">
                                                                <p className="text-[8px] text-brand-accent uppercase font-black">Alterar Categoria:</p>
                                                                {IMPACT_CATEGORIES.filter(cat => cat !== selectedImpactCategory).map(cat => (
                                                                    <button
                                                                        key={cat}
                                                                        disabled={savingImpactTaskId === t.id}
                                                                        onClick={async () => {
                                                                            setSavingImpactTaskId(t.id);
                                                                            const newObs = (t.observations || '').replace(`[${selectedImpactCategory}]`, `[${cat}]`);
                                                                            const result = await saveTask({ ...t, observations: newObs });
                                                                            if (result.success) {
                                                                                showToast(`Categoria alterada para ${cat}`, 'success');
                                                                            } else {
                                                                                showToast(`Erro ao alterar: ${result.error}`, 'error');
                                                                            }
                                                                            setSavingImpactTaskId(null);
                                                                            setEditingImpactTaskId(null);
                                                                        }}
                                                                        className="text-left text-[11px] text-gray-300 hover:text-brand-accent hover:bg-brand-accent/10 px-3 py-1.5 rounded-lg transition-all font-bold uppercase tracking-tight disabled:opacity-50"
                                                                    >
                                                                        {cat}
                                                                    </button>
                                                                ))}
                                                                <button
                                                                    onClick={() => setEditingImpactTaskId(null)}
                                                                    className="text-[10px] text-brand-med-gray hover:text-white mt-1 text-center transition-colors"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    title="Alterar Categoria de Impacto"
                                                                    onClick={() => setEditingImpactTaskId(t.id)}
                                                                    disabled={savingImpactTaskId === t.id}
                                                                    className="w-9 h-9 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center text-blue-400 hover:text-blue-300 transition-all border border-blue-500/20 hover:border-blue-500/40 disabled:opacity-50"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    title="Remover Impacto desta Tarefa"
                                                                    disabled={savingImpactTaskId === t.id}
                                                                    onClick={async () => {
                                                                        if (!confirm(`Tem certeza que deseja remover o impacto "${selectedImpactCategory}" desta tarefa?`)) return;
                                                                        setSavingImpactTaskId(t.id);
                                                                        const newObs = (t.observations || '').replace(`[${selectedImpactCategory}]`, '').replace(/\s{2,}/g, ' ').trim();
                                                                        const result = await saveTask({ ...t, observations: newObs });
                                                                        if (result.success) {
                                                                            showToast(`Impacto "${selectedImpactCategory}" removido com sucesso.`, 'success');
                                                                        } else {
                                                                            showToast(`Erro ao remover impacto: ${result.error}`, 'error');
                                                                        }
                                                                        setSavingImpactTaskId(null);
                                                                    }}
                                                                    className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-all border border-red-500/20 hover:border-red-500/40 disabled:opacity-50"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                            <div className="bg-[#0a0f18]/60 p-3 rounded-xl border border-white/5">
                                                <p className="text-[8px] text-brand-med-gray uppercase font-black mb-1">Apoio/Vão</p>
                                                <p className="text-xs text-white font-bold">{t.support || '-'}</p>
                                            </div>
                                            <div className="bg-[#0a0f18]/60 p-3 rounded-xl border border-white/5">
                                                <p className="text-[8px] text-brand-med-gray uppercase font-black mb-1">Nível</p>
                                                <p className="text-xs text-white font-bold">{t.level || '-'}</p>
                                            </div>
                                            <div className="bg-[#0a0f18]/60 p-3 rounded-xl border border-white/5">
                                                <p className="text-[8px] text-brand-med-gray uppercase font-black mb-1">Responsável</p>
                                                <p className="text-xs text-white font-bold">{t.assignee || '-'}</p>
                                            </div>
                                            <div className="bg-[#0a0f18]/60 p-3 rounded-xl border border-white/5">
                                                <p className="text-[8px] text-brand-med-gray uppercase font-black mb-1">Data Real</p>
                                                <p className="text-xs text-white font-bold font-mono">{formatDate(t.actualStartDate)}</p>
                                            </div>
                                        </div>

                                        <div className="bg-brand-accent/5 p-4 rounded-xl border border-brand-accent/10">
                                            <p className="text-[9px] text-brand-accent uppercase font-black mb-2">Observação de Campo:</p>
                                            <p className="text-xs text-gray-300 italic leading-relaxed">
                                                {t.observations?.replace(`[${selectedImpactCategory}]`, '').trim() || 'Sem detalhamento adicional.'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="p-6 bg-brand-dark/50 border-t border-white/5 text-center">
                            <p className="text-[10px] text-brand-med-gray font-bold uppercase tracking-widest opacity-50 italic">Fim da listagem de impactos para {selectedImpactCategory}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementPage;
