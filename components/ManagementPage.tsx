import React, { useEffect, useMemo, useState } from 'react';
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
import { useOrgMembers } from '../hooks/dataHooks';
import { buildEngineerDescendants, getTreeEngineerLabels, getEngineersForTask, normalizeString, normalizeName } from '../utils/engineerMapping';
import ManagementMonthlyProgress from './ManagementMonthlyProgress';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Line, ComposedChart, Cell, LabelList,
  AreaChart, Area, ReferenceLine
} from 'recharts';
import AlertIcon from './icons/AlertIcon';
import ConfirmModal from './ConfirmModal';

interface ManagementPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
  onNavigateToMonitoringControl?: () => void;
    onNavigateToMonitoringDashboard?: () => void;
    onNavigateToMonitoringDeviations?: () => void;
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

const IMPACT_CATEGORIES = ['Projeto', 'Mão de obra', 'Equipamento', 'Acesso', 'Chuva', 'Inspeção', 'Material', 'Predecessora', 'Interferências'] as const;

const ManagementPage: React.FC<ManagementPageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction, onNavigateToMonitoringControl,
    onNavigateToMonitoringDashboard,
    onNavigateToMonitoringDeviations,
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
        saveTask,
        enableScheduleLoading,
    } = useData();

    const { data: orgMembers } = useOrgMembers();

    // Ativar carregamento do cronograma vigente ao montar a página
    useEffect(() => {
        enableScheduleLoading();
    }, [enableScheduleLoading]);

    // Limite de itens renderizados (paginação progressiva para não travar o DOM)
    const [visibleItemCount, setVisibleItemCount] = useState(20);
    const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>(['Concluída', 'Em Andamento', 'Não Iniciada', 'Atrasada']);
    const [dateFilters, setDateFilters] = React.useState({ startDate: '', endDate: '' });
    // Filtro de nível aplicado aos painéis de PPC ('' = todos os níveis)
    const [ppcLevelFilter, setPpcLevelFilter] = React.useState('');
    // Filtro de engenheiro aplicado aos painéis de PPC ('' = todos os engenheiros)
    const [ppcEngineerFilter, setPpcEngineerFilter] = React.useState('');
    const [impactDateFilters, setImpactDateFilters] = React.useState({ startDate: '', endDate: '' });
    const [selectedImpactCategory, setSelectedImpactCategory] = React.useState<string | null>(null);
    const [editingImpactTaskId, setEditingImpactTaskId] = React.useState<string | null>(null);
    const [savingImpactTaskId, setSavingImpactTaskId] = React.useState<string | null>(null);
    const [deleteResponseConfirm, setDeleteResponseConfirm] = React.useState<{ isOpen: boolean; taskId: string | null }>({ isOpen: false, taskId: null });

    const canEditImpact = user && (user.role === 'Master' || user.role === 'Planejador');
    const canRespondToImpact = user && (user.role === 'Master' || user.role === 'Planejador' || user.role === 'Gerenciador');
    
    const [respondingToTaskId, setRespondingToTaskId] = useState<string | null>(null);
    const [responseText, setResponseText] = useState('');

    // Visão ativa do painel: KPIs Cronograma Master ou KPIs Programação Semanal
    const [activeKpiView, setActiveKpiView] = useState<'master' | 'semanal'>('master');

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

    // Pré-indexar tasks por baseline_id — O(n) ao invés de O(n*m) no loop
    const tasksByBaselineId = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const t of tasks) {
            const bid = String(t.baseline_id || '');
            if (!bid) continue;
            const arr = map.get(bid);
            if (arr) arr.push(t);
            else map.set(bid, [t]);
        }
        return map;
    }, [tasks]);

    // Níveis disponíveis para o filtro dos painéis de PPC
    const ppcLevelOptions = useMemo(() => {
        const levels = new Set<string>();
        for (const t of tasks) {
            if (t.level) levels.add(t.level);
        }
        return Array.from(levels).sort((a, b) => a.localeCompare(b));
    }, [tasks]);

    // Mapa engenheiro→descendentes (árvore do organograma), igual ao Dashboard
    const engineerDescendants = useMemo(() => buildEngineerDescendants(orgMembers || []), [orgMembers]);

    // Engenheiros disponíveis para o filtro dos painéis de PPC (OAE + árvore)
    const ppcEngineerOptions = useMemo(() => {
        const engineers = new Set<string>();
        for (const t of tasks) {
            getEngineersForTask(t, engineerDescendants).forEach(e => engineers.add(e));
        }
        getTreeEngineerLabels(orgMembers || []).forEach(e => engineers.add(e));
        return Array.from(engineers).sort((a, b) => a.localeCompare(b));
    }, [tasks, engineerDescendants, orgMembers]);

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
                const linkedTasks = tasksByBaselineId.get(String(bt.id)) || [];

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
    }, [tasksByBaselineId, currentScheduleTasks, currentScheduleCutOffDateStr, selectedStatuses, dateFilters]);

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
            const tDateStr = t.dueDate || t.actualEndDate || '';
            if (impactDateFilters.startDate || impactDateFilters.endDate) {
                const tDate = new Date(tDateStr + 'T00:00:00');
                const start = impactDateFilters.startDate ? new Date(impactDateFilters.startDate + 'T00:00:00') : null;
                const end = impactDateFilters.endDate ? new Date(impactDateFilters.endDate + 'T23:59:59') : null;
                if (start && tDate < start) return;
                if (end && tDate > end) return;
            }

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
    }, [tasks, impactDateFilters]);

    const weeklyImpactData = useMemo(() => {
        const weekMap: Record<string, { values: Record<string, number>, weekNum: number }> = {};
        const categories = IMPACT_CATEGORIES;

        tasks.forEach(t => {
            const tDateStr = t.dueDate || t.actualEndDate || '';
            if (impactDateFilters.startDate || impactDateFilters.endDate) {
                const tDate = new Date(tDateStr + 'T00:00:00');
                const start = impactDateFilters.startDate ? new Date(impactDateFilters.startDate + 'T00:00:00') : null;
                const end = impactDateFilters.endDate ? new Date(impactDateFilters.endDate + 'T23:59:59') : null;
                if (start && tDate < start) return;
                if (end && tDate > end) return;
            }

            const obs = t.observations || '';
            const hasImpact = categories.some(cat => obs.includes(`[${cat}]`));
            if (!hasImpact) return;

            const d = new Date(t.dueDate + 'T00:00:00');
            
            // Início da semana (Domingo)
            const sun = new Date(d);
            sun.setDate(d.getDate() - d.getDay());
            
            // Fim da semana (Sábado)
            const sat = new Date(sun);
            sat.setDate(sun.getDate() + 6);

            // Calcula número da semana (ISO) para ordenação
            const target = new Date(d.valueOf());
            const dayNr = (d.getDay() + 6) % 7;
            target.setDate(target.getDate() - dayNr + 3);
            const firstThursday = target.valueOf();
            target.setMonth(0, 1);
            if (target.getDay() !== 4) {
                target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
            }
            const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
            
            const formatDateShort = (date: Date) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                return `${day}/${month}`;
            };

            const weekLabel = formatDateShort(sat);

            if (!weekMap[weekLabel]) {
                weekMap[weekLabel] = {
                    weekNum,
                    values: {}
                };
                categories.forEach(c => weekMap[weekLabel].values[c] = 0);
            }

            categories.forEach(cat => {
                if (obs.includes(`[${cat}]`)) {
                    weekMap[weekLabel].values[cat]++;
                }
            });
        });

        return Object.entries(weekMap)
            .sort((a, b) => a[1].weekNum - b[1].weekNum)
            .map(([week, data]) => ({
                week,
                ...data.values
            }))
            .slice(-20);
    }, [tasks, impactDateFilters]);

    // --- LÓGICA PPC SEMANAL (Semanas Fechadas) ---
    const weeklyPpcData = useMemo(() => {
        // Data do último sábado fechado
        const now = new Date();
        const lastClosedSaturday = new Date(now);
        lastClosedSaturday.setDate(now.getDate() - (now.getDay() + 1));
        lastClosedSaturday.setHours(23, 59, 59, 999);

        const engineerKey = ppcEngineerFilter ? normalizeString(normalizeName(ppcEngineerFilter)) : '';
        const tasksToUse = tasks.filter(t => {
            if (ppcLevelFilter && t.level !== ppcLevelFilter) return false;
            if (engineerKey) {
                const engs = getEngineersForTask(t, engineerDescendants);
                if (!engs.some(e => normalizeString(normalizeName(e)) === engineerKey)) return false;
            }
            if (!dateFilters.startDate && !dateFilters.endDate) return true;
            const tDate = new Date(t.dueDate + 'T00:00:00');
            const start = dateFilters.startDate ? new Date(dateFilters.startDate + 'T00:00:00') : null;
            const end = dateFilters.endDate ? new Date(dateFilters.endDate + 'T23:59:59') : null;
            return (!start || tDate >= start) && (!end || tDate <= end);
        });

        if (tasksToUse.length === 0) return [];

        const start = new Date(Math.min(...tasksToUse.map(t => new Date(t.startDate).getTime())));
        const end = new Date(Math.max(...tasksToUse.map(t => new Date(t.dueDate).getTime())));

        const weeks: { [key: string]: { planned: number; completed: number; weekNum: number; weekEnd: Date } } = {};

        tasksToUse.forEach(task => {
            const taskDueDate = new Date(task.dueDate + 'T23:59:59');
            if (taskDueDate >= start && taskDueDate <= end) {
                const d = new Date(taskDueDate);
                d.setDate(d.getDate() - d.getDay()); // Domingo
                
                const weekEnd = new Date(d);
                weekEnd.setDate(d.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);

                // SÓ ENTRA NO CÁLCULO SE A SEMANA ESTIVER FECHADA
                if (weekEnd > lastClosedSaturday) return;

                const weekKey = weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                
                if (!weeks[weekKey]) {
                    // Calcula número da semana para ordenação
                    const target = new Date(d.valueOf());
                    const dayNr = (d.getDay() + 6) % 7;
                    target.setDate(target.getDate() - dayNr + 3);
                    const firstThursday = target.valueOf();
                    target.setMonth(0, 1);
                    if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
                    const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
                    
                    weeks[weekKey] = { planned: 0, completed: 0, weekNum, weekEnd };
                }
                
                weeks[weekKey].planned += 1;
                // Só conta como cumprida se foi concluída dentro da própria semana programada
                if (task.status === TaskStatus.Completed && task.actualEndDate) {
                    const weekStart = new Date(d);
                    weekStart.setHours(0, 0, 0, 0);
                    const actualEnd = new Date(task.actualEndDate + 'T12:00:00');
                    if (actualEnd >= weekStart && actualEnd <= weekEnd) {
                        weeks[weekKey].completed += 1;
                    }
                }
            }
        });

        return Object.keys(weeks).sort((a, b) => weeks[a].weekNum - weeks[b].weekNum)
            .map(week => ({
                name: `${week}`,
                ppc: weeks[week].planned > 0 ? Math.round((weeks[week].completed / weeks[week].planned) * 100) : 0,
            }));
    }, [tasks, dateFilters, ppcLevelFilter, ppcEngineerFilter, engineerDescendants]);

    const averagePpc = useMemo(() => {
        if (weeklyPpcData.length === 0) return 0;
        return Math.round(weeklyPpcData.reduce((acc, d) => acc + d.ppc, 0) / weeklyPpcData.length);
    }, [weeklyPpcData]);

    // --- LÓGICA PPC ACUMULADO (Linha Realizada interrompida na última fechada) ---
    const accumulatedPpcData = useMemo(() => {
        const now = new Date();
        const lastClosedSaturday = new Date(now);
        lastClosedSaturday.setDate(now.getDate() - (now.getDay() + 1));
        lastClosedSaturday.setHours(23, 59, 59, 999);

        const projectStart = new Date('2026-02-15T00:00:00'); // Início da análise em 21/02

        const engineerKey = ppcEngineerFilter ? normalizeString(normalizeName(ppcEngineerFilter)) : '';
        const tasksToUse = tasks.filter(t => {
            if (ppcLevelFilter && t.level !== ppcLevelFilter) return false;
            if (engineerKey) {
                const engs = getEngineersForTask(t, engineerDescendants);
                if (!engs.some(e => normalizeString(normalizeName(e)) === engineerKey)) return false;
            }
            const tDate = new Date(t.dueDate + 'T00:00:00');
            if (tDate < projectStart) return false;

            if (!dateFilters.startDate && !dateFilters.endDate) return true;
            const start = dateFilters.startDate ? new Date(dateFilters.startDate + 'T00:00:00') : null;
            const end = dateFilters.endDate ? new Date(dateFilters.endDate + 'T23:59:59') : null;
            return (!start || tDate >= start) && (!end || tDate <= end);
        });

        if (tasksToUse.length === 0) return [];

        // PRÉ-PROCESSAR: calcular timestamps uma vez e ordenar por dueDate
        // Isso transforma O(semanas × tasks) em O(tasks × log(tasks) + semanas)
        const processed = tasksToUse.map(task => {
            const dueDateTs = new Date(task.dueDate + 'T00:00:00').getTime();
            let completedOnTime = false;
            if (task.status === TaskStatus.Completed && task.actualEndDate) {
                // Concluída dentro da própria semana programada (domingo→sábado do dueDate)
                const weekStart = new Date(task.dueDate + 'T12:00:00');
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                const actualEnd = new Date(task.actualEndDate + 'T12:00:00');
                completedOnTime = actualEnd >= weekStart && actualEnd <= weekEnd;
            }
            return { dueDateTs, completedOnTime };
        }).sort((a, b) => a.dueDateTs - b.dueDateTs);

        const allDueDates = processed.map(p => p.dueDateTs);
        const maxDate = new Date(allDueDates[allDueDates.length - 1]);

        // Prefix-sum para contagem de "completedOnTime" — torna cada consulta O(log n)
        const completedPrefix = new Array(processed.length + 1);
        completedPrefix[0] = 0;
        for (let i = 0; i < processed.length; i++) {
            completedPrefix[i + 1] = completedPrefix[i] + (processed[i].completedOnTime ? 1 : 0);
        }

        // Função de busca binária: quantas tasks têm dueDate <= weekEndTs
        const countUpTo = (endTs: number): { total: number; completed: number } => {
            let lo = 0, hi = processed.length;
            while (lo < hi) {
                const mid = (lo + hi) >>> 1;
                if (processed[mid].dueDateTs <= endTs) lo = mid + 1;
                else hi = mid;
            }
            return { total: lo, completed: completedPrefix[lo] };
        };

        const tasksByWeek: { key: string; total: number; completed: number; weekEnd: Date }[] = [];
        const current = new Date(projectStart);

        while (current <= maxDate) {
            const weekEnd = new Date(current);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const key = weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const { total, completed } = countUpTo(weekEnd.getTime());

            tasksByWeek.push({ key, total, completed, weekEnd });
            current.setDate(current.getDate() + 7);
        }

        const totalTasksCount = tasksToUse.length;
        return tasksByWeek.map(week => {
            const data: any = {
                name: `${week.key}`,
                planejado: Math.round((week.total / totalTasksCount) * 100),
            };
            
            if (week.weekEnd <= lastClosedSaturday) {
                data.realizado = Math.round((week.completed / totalTasksCount) * 100);
            }
            
            return data;
        });
    }, [tasks, dateFilters, ppcLevelFilter, ppcEngineerFilter, engineerDescendants]);

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
                onNavigateToMonitoringControl={onNavigateToMonitoringControl}
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
                onNavigateToMonitoringControl={onNavigateToMonitoringControl}
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

                        {/* Quadros grandes selecionáveis: KPIs Cronograma Master e KPIs Programação Semanal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 non-printable">
                            <button
                                onClick={() => setActiveKpiView('master')}
                                className={`group relative flex flex-col gap-4 text-left p-7 rounded-3xl border transition-all duration-300 shadow-2xl overflow-hidden ${
                                    activeKpiView === 'master'
                                        ? 'bg-gradient-to-br from-blue-600/20 to-[#111827] border-blue-500/60 ring-1 ring-blue-500/40 shadow-blue-900/30'
                                        : 'bg-[#111827]/60 border-white/10 hover:border-blue-500/40 hover:bg-[#111827]'
                                }`}
                            >
                                <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                                        activeKpiView === 'master' ? 'bg-blue-600/25 border border-blue-500/50' : 'bg-blue-600/15 border border-blue-500/30'
                                    }`}>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                                            <path d="M3 3v18h18" />
                                            <path d="M7 14l3-3 3 3 5-6" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">KPIs Cronograma Master</h3>
                                        <p className="text-[11px] text-brand-med-gray mt-1">Serviços notáveis, resumo dos desvios e Curva S</p>
                                    </div>
                                    {activeKpiView === 'master' && (
                                        <span className="px-2.5 py-1 bg-blue-500/20 border border-blue-500/40 rounded-lg text-[9px] font-black text-blue-300 uppercase tracking-widest shrink-0">Ativo</span>
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={() => setActiveKpiView('semanal')}
                                className={`group relative flex flex-col gap-4 text-left p-7 rounded-3xl border transition-all duration-300 shadow-2xl overflow-hidden ${
                                    activeKpiView === 'semanal'
                                        ? 'bg-gradient-to-br from-brand-accent/20 to-[#111827] border-brand-accent/60 ring-1 ring-brand-accent/40 shadow-orange-900/30'
                                        : 'bg-[#111827]/60 border-white/10 hover:border-brand-accent/40 hover:bg-[#111827]'
                                }`}
                            >
                                <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-accent/50 to-transparent"></div>
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                                        activeKpiView === 'semanal' ? 'bg-brand-accent/25 border border-brand-accent/50' : 'bg-brand-accent/15 border border-brand-accent/30'
                                    }`}>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-accent">
                                            <path d="M3 3v18h18" />
                                            <path d="M18 9l-5 5-3-3-4 4" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">KPIs Programação Semanal</h3>
                                        <p className="text-[11px] text-brand-med-gray mt-1">Curvas de PPC e causas de não cumprimento</p>
                                    </div>
                                    {activeKpiView === 'semanal' && (
                                        <span className="px-2.5 py-1 bg-brand-accent/20 border border-brand-accent/40 rounded-lg text-[9px] font-black text-brand-accent uppercase tracking-widest shrink-0">Ativo</span>
                                    )}
                                </div>
                            </button>
                        </div>

                        {/* Sub-acessos do KPIs Cronograma Master: Serviços Notáveis e Resumo dos Desvios */}
                        {activeKpiView === 'master' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 non-printable">
                            <button
                                onClick={onNavigateToMonitoringDashboard}
                                disabled={!onNavigateToMonitoringDashboard}
                                className="group flex items-center gap-4 text-left p-5 rounded-2xl bg-[#111827]/60 border border-white/10 hover:border-blue-500/50 hover:bg-[#111827] transition-all duration-300 shadow-xl hover:shadow-blue-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                                        <path d="M3 3v18h18" />
                                        <path d="M7 14l3-3 3 3 5-6" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black text-white uppercase tracking-wide">Serviços Notáveis</h3>
                                    <p className="text-[11px] text-brand-med-gray">Curvas e indicadores operacionais por serviço / OAE</p>
                                </div>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-med-gray group-hover:text-blue-400 group-hover:translate-x-1 transition-all shrink-0">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>

                            <button
                                onClick={onNavigateToMonitoringDeviations}
                                disabled={!onNavigateToMonitoringDeviations}
                                className="group flex items-center gap-4 text-left p-5 rounded-2xl bg-[#111827]/60 border border-white/10 hover:border-red-500/50 hover:bg-[#111827] transition-all duration-300 shadow-xl hover:shadow-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <div className="w-12 h-12 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <AlertIcon className="w-6 h-6 text-red-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black text-white uppercase tracking-wide">Resumo dos Desvios</h3>
                                    <p className="text-[11px] text-brand-med-gray">Análise de desvios e causas de impacto</p>
                                </div>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-med-gray group-hover:text-red-400 group-hover:translate-x-1 transition-all shrink-0">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                        )}

                        {/* Resumo Gerencial */}
                        {activeKpiView === 'master' && globalStats && (
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

                        {activeKpiView === 'semanal' && (<>
                        {/* Filtros dos painéis de PPC */}
                        <div className="flex items-center gap-4 non-printable flex-wrap">
                            <div className="flex items-center gap-3">
                                <label htmlFor="ppc-level-filter" className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest">
                                    PPC por Nível
                                </label>
                                <select
                                    id="ppc-level-filter"
                                    value={ppcLevelFilter}
                                    onChange={e => setPpcLevelFilter(e.target.value)}
                                    className="bg-[#0a0f18] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 shadow-inner appearance-none custom-select min-w-[180px]"
                                >
                                    <option value="">Todos os níveis</option>
                                    {ppcLevelOptions.map(lvl => (
                                        <option key={lvl} value={lvl}>{lvl}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <label htmlFor="ppc-engineer-filter" className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest">
                                    Engenheiro
                                </label>
                                <select
                                    id="ppc-engineer-filter"
                                    value={ppcEngineerFilter}
                                    onChange={e => setPpcEngineerFilter(e.target.value)}
                                    className="bg-[#0a0f18] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 shadow-inner appearance-none custom-select min-w-[180px]"
                                >
                                    <option value="">Todos os engenheiros</option>
                                    {ppcEngineerOptions.map(eng => (
                                        <option key={eng} value={eng}>{eng}</option>
                                    ))}
                                </select>
                            </div>

                            {(ppcLevelFilter || ppcEngineerFilter) && (
                                <button
                                    onClick={() => { setPpcLevelFilter(''); setPpcEngineerFilter(''); }}
                                    className="text-[10px] font-bold text-brand-med-gray hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>

                        {/* Indicadores de PPC (Percentual de Plano Cumprido) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 non-printable mb-8">
                            <div className="bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl hover-shine relative overflow-hidden group">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-brand-accent rounded-full shadow-[0_0_10px_rgba(227,90,16,0.3)]"></div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Curva PPC Semanal</h4>
                                    </div>
                                    <div className="bg-brand-accent/10 px-3 py-1 rounded-xl border border-brand-accent/20">
                                        <span className="text-brand-accent font-black text-xl">{averagePpc}%</span>
                                        <span className="text-[9px] text-gray-500 uppercase font-bold ml-2">Média</span>
                                    </div>
                                </div>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={weeklyPpcData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                            <XAxis dataKey="name" stroke="#475569" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                                            <YAxis stroke="#475569" fontSize={10} fontWeight={700} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '11px' }}
                                                itemStyle={{ fontWeight: 'bold' }}
                                            />
                                            <ReferenceLine y={averagePpc} stroke="#e35a10" strokeDasharray="4 4" strokeWidth={1.5} />
                                            <Bar dataKey="ppc" name="PPC %" radius={[4, 4, 0, 0]} barSize={30}>
                                                {weeklyPpcData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.ppc >= 80 ? '#10b981' : entry.ppc >= 60 ? '#f59e0b' : '#ef4444'} />
                                                ))}
                                                <LabelList 
                                                    dataKey="ppc" 
                                                    position="top" 
                                                    fill="#94a3b8" 
                                                    fontSize={9} 
                                                    fontWeight="bold" 
                                                    formatter={(v: any) => `${v}%`} 
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl hover-shine relative overflow-hidden group">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"></div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest">PPC Acumulado</h4>
                                </div>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={accumulatedPpcData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorPlanejado" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                            <XAxis dataKey="name" stroke="#475569" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                                            <YAxis stroke="#475569" fontSize={10} fontWeight={700} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '11px' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '10px', textTransform: 'uppercase', fontSize: '8px', fontWeight: '900' }} />
                                            <Area type="monotone" dataKey="planejado" name="Planejado" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPlanejado)" />
                                            <Area type="monotone" dataKey="realizado" name="Realizado" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRealizado)" connectNulls={true} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Seção Consolidada: Análise de Causas de Não Cumprimento */}
                        <div className="bg-[#111827]/60 backdrop-blur-xl rounded-3xl border border-white/10 p-2 shadow-2xl overflow-hidden non-printable relative mb-12">
                            {/* Brilho de destaque superior */}
                            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-accent/50 to-transparent"></div>
                            
                            <div className="p-6">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 pb-6 border-b border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-brand-accent/10 rounded-2xl border border-brand-accent/20">
                                            <AlertIcon className="w-6 h-6 text-brand-accent" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Causas de Não Cumprimento</h3>
                                            <p className="text-[10px] text-brand-med-gray font-bold uppercase tracking-widest mt-1">Gestão de Impactos e Root Cause Analysis</p>
                                        </div>
                                    </div>

                                    {/* Filtro Setorial para Impactos */}
                                    <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-2 group">
                                            <span className="text-[9px] font-black text-brand-med-gray uppercase tracking-widest group-hover:text-brand-accent transition-colors">Período para Causas:</span>
                                            <input
                                                type="date"
                                                value={impactDateFilters.startDate}
                                                onChange={(e) => setImpactDateFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                className="bg-brand-dark cursor-pointer text-[10px] font-bold text-white px-3 py-1.5 rounded-xl border border-white/5 hover:border-brand-accent/30 focus:outline-none transition-all placeholder:text-gray-600"
                                            />
                                            <span className="text-gray-600 font-bold text-sm">→</span>
                                            <input
                                                type="date"
                                                value={impactDateFilters.endDate}
                                                onChange={(e) => setImpactDateFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                className="bg-brand-dark cursor-pointer text-[10px] font-bold text-white px-3 py-1.5 rounded-xl border border-white/5 hover:border-brand-accent/30 focus:outline-none transition-all placeholder:text-gray-600"
                                            />
                                            {(impactDateFilters.startDate || impactDateFilters.endDate) && (
                                                <button 
                                                    onClick={() => setImpactDateFilters({ startDate: '', endDate: '' })}
                                                    className="p-1.5 hover:bg-white/5 rounded-lg text-red-500 transition-colors"
                                                    title="Limpar Filtro de Impactos"
                                                >
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                    {/* Pareto de Impactos (2/3) */}
                                    <div className="lg:col-span-2 bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner group">
                                        <div className="mb-6 h-[40px] flex flex-col justify-end">
                                            <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2">Pareto de Ofensores</h4>
                                            <p className="text-[9px] text-brand-med-gray mt-2 italic">Principais categorias que impediram o cumprimento das metas</p>
                                        </div>
                                        <div className="h-[350px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={paretoData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                                    <defs>
                                                        <linearGradient id="gradientB" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                                                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.6}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                                                    <XAxis dataKey="label" stroke="#475569" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                                                    <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                                    <Bar dataKey="count" radius={[6, 6, 2, 2]} barSize={44} fill="url(#gradientB)">
                                                        <LabelList dataKey="count" position="top" fill="#94a3b8" fontSize={11} fontWeight={900} offset={8} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Classificação com Drill-down (1/3) */}
                                    <div className="lg:col-span-1 bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                                        <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2 mb-6 text-center">Detalhamento por Causa</h4>
                                        <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                            {paretoData.map((item, idx) => (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => setSelectedImpactCategory(item.label === selectedImpactCategory ? null : item.label)}
                                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                                                        selectedImpactCategory === item.label ? 'bg-brand-accent/20 border-brand-accent/50 ring-1 ring-brand-accent/30' : 'bg-white/5 border-white/10 hover:border-brand-accent/50 hover:bg-brand-accent/5'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${
                                                            item.abc === 'A' ? 'bg-red-500/10 text-red-500' : 
                                                            item.abc === 'B' ? 'bg-blue-500/10 text-blue-500' : 
                                                            'bg-gray-500/10 text-gray-500'
                                                        }`}>
                                                            {idx === 0 ? <AlertIcon className="w-5 h-5" /> : <InfoIcon className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-white uppercase tracking-tight">{item.label}</p>
                                                            <p className="text-[10px] text-brand-med-gray font-bold">{item.count} ocorrências</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Tendência Semanal (No mesmo agrupamento) */}
                                <div className="bg-black/10 p-6 rounded-2xl border border-white/5 shadow-inner">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h4 className="text-xs font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2">Evolução Semanal de Impactos</h4>
                                            <p className="text-[9px] text-brand-med-gray mt-2 italic">Distribuição temporal das causas de não cumprimento</p>
                                        </div>
                                    </div>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={weeklyImpactData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                                                <XAxis dataKey="week" stroke="#475569" fontSize={9} fontWeight={700} axisLine={false} tickLine={false} />
                                                <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #ffffff10', borderRadius: '16px', fontSize: '10px' }} />
                                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '15px' }} />
                                                <Bar dataKey="Projeto" stackId="a" fill="#3b82f6" />
                                                <Bar dataKey="Mão de obra" stackId="a" fill="#10b981" />
                                                <Bar dataKey="Equipamento" stackId="a" fill="#f59e0b" />
                                                <Bar dataKey="Acesso" stackId="a" fill="#8b5cf6" />
                                                <Bar dataKey="Chuva" stackId="a" fill="#0ea5e9" />
                                                <Bar dataKey="Inspeção" stackId="a" fill="#ec4899" />
                                                <Bar dataKey="Material" stackId="a" fill="#f43f5e" />
                                                <Bar dataKey="Predecessora" stackId="a" fill="#6366f1" />
                                                <Bar dataKey="Interferências" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </>)}

                        {/* Planejamento Mensal e Curva S */}
                        {activeKpiView === 'master' && (
                        <ManagementMonthlyProgress
                            data={monthlyPlanning}
                            onSave={setMonthlyPlanning}
                            canEdit={user && (user.role === 'Master' || user.role === 'Planejador')}
                        />
                        )}

                        {activeKpiView === 'master' && (
                        <div className="grid grid-cols-1 gap-4">
                            {analysisData.length === 0 ? (
                                <div className="bg-brand-dark/70 p-12 rounded-lg text-center text-brand-med-gray">
                                    Nenhum item macro corresponde aos filtros selecionados.
                                </div>
                            ) : (
                                analysisData.slice(0, visibleItemCount).map(({ baseline, tasks: linkedTasks, stats, isPastCutoff }) => {
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
                            {analysisData.length > visibleItemCount && (
                                <button
                                    onClick={() => setVisibleItemCount(prev => prev + 20)}
                                    className="w-full py-4 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/20 hover:border-brand-accent/40 rounded-xl text-brand-accent font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                                >
                                    <span>Mostrar mais {Math.min(20, analysisData.length - visibleItemCount)} itens</span>
                                    <span className="text-brand-med-gray">({visibleItemCount} de {analysisData.length})</span>
                                </button>
                            )}
                        </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modal de confirmação para excluir resposta */}
            <ConfirmModal 
                isOpen={deleteResponseConfirm.isOpen}
                onClose={() => setDeleteResponseConfirm({ isOpen: false, taskId: null })}
                onConfirm={async () => {
                    const taskId = deleteResponseConfirm.taskId;
                    if (!taskId) return;
                    
                    setDeleteResponseConfirm(prev => ({ ...prev, isOpen: false }));
                    setSavingImpactTaskId(taskId);
                    
                    const t = tasks.find(item => item.id === taskId) || 
                              currentScheduleTasks.find(item => item.id === taskId);
                    
                    if (!t) {
                        showToast('Tarefa não encontrada.', 'error');
                        setSavingImpactTaskId(null);
                        return;
                    }

                    const result = await saveTask({
                        ...t,
                        response: null as any,
                        response_user: null as any,
                        response_at: null as any
                    });

                    if (result.success) {
                        showToast('Resposta excluída!', 'success');
                    } else {
                        showToast(`Erro ao excluir: ${result.error}`, 'error');
                    }
                    setSavingImpactTaskId(null);
                    setDeleteResponseConfirm({ isOpen: false, taskId: null });
                }}
                title="Excluir Resposta"
                message="Tem certeza que deseja excluir esta resposta? Esta ação não pode ser desfeita."
                confirmText="Excluir"
                cancelText="Cancelar"
                type="danger"
                isLoading={savingImpactTaskId === deleteResponseConfirm.taskId && savingImpactTaskId !== null}
            />

            {/* Modal de Detalhamento de Impactos (Drill-down) */}
            {selectedImpactCategory && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedImpactCategory(null)}>
                    <div 
                        className="bg-[#0a0f18] border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
                        onClick={e => {
                            e.stopPropagation();
                        }}
                    >
                        <div className="p-8 border-b border-white/5 bg-brand-accent/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <span className="text-brand-accent">Detalhamento:</span> {selectedImpactCategory}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-brand-med-gray">Listagem de tarefas com este impacto no cronograma.</p>
                                    {(impactDateFilters.startDate || impactDateFilters.endDate) && (
                                        <span className="px-2 py-0.5 bg-brand-accent/20 border border-brand-accent/30 rounded text-[9px] text-brand-accent font-black uppercase animate-pulse">
                                            Exibindo apenas período selecionado
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => {
                                setSelectedImpactCategory(null);
                                setRespondingToTaskId(null);
                                setResponseText('');
                            }} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all border border-white/10 group">
                                <XIcon className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                            {(() => {
                                const list = tasks.filter(t => {
                                    if (!(t.observations || '').includes(`[${selectedImpactCategory}]`)) return false;
                                    
                                    const tDateStr = t.dueDate || t.actualEndDate || '';
                                    if (impactDateFilters.startDate || impactDateFilters.endDate) {
                                        const tDate = new Date(tDateStr + 'T00:00:00');
                                        const start = impactDateFilters.startDate ? new Date(impactDateFilters.startDate + 'T00:00:00') : null;
                                        const end = impactDateFilters.endDate ? new Date(impactDateFilters.endDate + 'T23:59:59') : null;
                                        if (start && tDate < start) return false;
                                        if (end && tDate > end) return false;
                                    }
                                    return true;
                                });

                                if (list.length === 0) {
                                    return (
                                        <div className="text-center py-20 opacity-30">
                                            <p className="text-sm font-bold uppercase tracking-widest text-brand-med-gray">Nenhuma tarefa encontrada neste filtro/período.</p>
                                        </div>
                                    );
                                }

                                return list.map(t => (
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

                                        {/* RESPOSTA */}
                                        <div className="mt-4 flex flex-col gap-3">
                                            {t.response ? (
                                                <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 relative group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <p className="text-[9px] text-green-400 uppercase font-black">Resposta:</p>
                                                        {canRespondToImpact && (
                                                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => {
                                                                        setRespondingToTaskId(t.id);
                                                                        setResponseText(t.response || '');
                                                                    }}
                                                                    className="text-[10px] text-green-400 font-bold hover:text-green-200 uppercase tracking-tighter"
                                                                >
                                                                    Editar
                                                                </button>
                                                                <button 
                                                                    disabled={savingImpactTaskId === t.id}
                                                                    onClick={() => {
                                                                        setDeleteResponseConfirm({ isOpen: true, taskId: t.id });
                                                                    }}
                                                                    className="text-[10px] text-red-400 font-bold hover:text-red-300 uppercase tracking-tighter"
                                                                >
                                                                    Excluir
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-200 leading-relaxed font-semibold">
                                                        {t.response}
                                                    </p>
                                                    <div className="flex justify-between mt-3 pt-3 border-t border-green-500/20 text-[11px] font-bold uppercase tracking-wide">
                                                        <span className="flex items-center gap-1.5 text-green-300">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                            {t.response_user}
                                                        </span>
                                                        <span className="flex items-center gap-1.5 text-gray-300">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            {t.response_at ? new Date(t.response_at).toLocaleString('pt-BR') : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : canRespondToImpact && respondingToTaskId !== t.id && (
                                                <button 
                                                    onClick={() => setRespondingToTaskId(t.id)}
                                                    className="w-full flex items-center justify-center gap-2 p-3 bg-green-500/5 hover:bg-green-500/10 border border-dashed border-green-500/20 hover:border-green-500/40 rounded-xl text-[10px] font-black text-green-400 uppercase tracking-widest transition-all"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    Lançar Resposta
                                                </button>
                                            )}

                                            {respondingToTaskId === t.id && (
                                                <div className="bg-[#0a0f18] border border-green-500/30 rounded-xl p-4 shadow-2xl animate-scale-in">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <p className="text-[9px] text-green-400 uppercase font-black">Nova Resposta:</p>
                                                        <button 
                                                            onClick={() => {
                                                                setRespondingToTaskId(null);
                                                                setResponseText('');
                                                            }}
                                                            className="text-gray-500 hover:text-white transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                    <textarea 
                                                        autoFocus
                                                        value={responseText}
                                                        onChange={(e) => setResponseText(e.target.value)}
                                                        placeholder="Digite aqui a resposta para este impacto..."
                                                        className="w-full h-24 bg-black/40 border border-white/5 rounded-lg p-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-green-500/50 transition-all resize-none"
                                                    />
                                                    <div className="flex justify-end gap-2 mt-3">
                                                        <button 
                                                            disabled={savingImpactTaskId === t.id}
                                                            onClick={() => {
                                                                setRespondingToTaskId(null);
                                                                setResponseText('');
                                                            }}
                                                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-gray-400 transition-all uppercase"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button 
                                                            disabled={savingImpactTaskId === t.id || !responseText.trim()}
                                                            onClick={async () => {
                                                                setSavingImpactTaskId(t.id);
                                                                const result = await saveTask({
                                                                    ...t,
                                                                    response: responseText.trim(),
                                                                    response_user: user.fullName || user.username,
                                                                    response_at: new Date().toISOString()
                                                                });
                                                                if (result.success) {
                                                                    showToast('Resposta salva com sucesso!', 'success');
                                                                    setRespondingToTaskId(null);
                                                                    setResponseText('');
                                                                } else {
                                                                    showToast(`Erro ao salvar: ${result.error}`, 'error');
                                                                }
                                                                setSavingImpactTaskId(null);
                                                            }}
                                                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-[10px] font-black text-white transition-all uppercase disabled:opacity-50 flex items-center gap-2"
                                                        >
                                                            {savingImpactTaskId === t.id ? (
                                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                            ) : null}
                                                            Salvar Resposta
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ));
                            })()}
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

