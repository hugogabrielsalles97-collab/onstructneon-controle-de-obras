import React, { useState, useMemo } from 'react';
import { User, Task, TaskStatus } from '../types';
import { getAnchorDue, getAnchorStart, taskCurrentDiffersFromInitialPlan, resolveBaselineTask } from '../utils/taskPlanning';
import { useData } from '../context/DataProvider';
import Header from './Header';
import DashboardSummary from './DashboardSummary';
import StatusChart from './StatusChart';
import ClearIcon from './icons/ClearIcon';
import FilterInput from './ui/FilterInput';
import Sidebar from './Sidebar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, AreaChart, Area, Legend } from 'recharts';

interface ReportsPageProps {
  onNavigateToDashboard: () => void;
  onNavigateToReports: () => void;
  onNavigateToBaseline: () => void;
  onNavigateToCurrentSchedule: () => void;
  onNavigateToAnalysis: () => void;
  onNavigateToLean: () => void;
  onNavigateToLeanConstruction: () => void;
  onNavigateToMonitoringControl?: () => void;
  onNavigateToWarRoom: () => void;
  onNavigateToPodcast: () => void;
  onNavigateToCost: () => void;
  onNavigateToCheckoutSummary: () => void;
  onNavigateToOrgChart?: () => void;
  onNavigateToOrgSummary?: () => void;
  onNavigateToVisualControl?: () => void;
  onNavigateToTeams?: () => void;
  onNavigateToSystem?: () => void;
  onUpgradeClick: () => void;
  onAddTask?: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const ReportSectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xl font-semibold text-gray-100 mb-4 pb-2 border-b-2 border-brand-dark/80 relative">
    <span className="text-brand-accent">{children}</span>
    <div className="absolute bottom-[-2px] left-0 h-0.5 w-1/4 bg-brand-accent"></div>
  </h3>
);

const ReportsPage: React.FC<ReportsPageProps> = ({
  onNavigateToDashboard,
  onNavigateToReports,
  onNavigateToBaseline,
  onNavigateToCurrentSchedule,
  onNavigateToAnalysis,
  onNavigateToLean,
  onNavigateToLeanConstruction, onNavigateToMonitoringControl,
  onNavigateToWarRoom,
  onNavigateToPodcast,
  onNavigateToCost,
  onNavigateToCheckoutSummary,
  onNavigateToHome,
  onNavigateToOrgChart,
  onNavigateToOrgSummary,
  onNavigateToVisualControl,
  onNavigateToTeams,
  onNavigateToSystem,
  onUpgradeClick,
  onAddTask,
  showToast
}) => {
  const { currentUser: user, tasks, baselineTasks, signOut } = useData();
  const [dateFilters, setDateFilters] = useState({ startDate: '', endDate: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'rescheduled' | TaskStatus>('all');

  if (!user) return null;

  const handleLogout = async () => {
    const { success, error } = await signOut();
    if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setDateFilters({ startDate: '', endDate: '' });
    setStatusFilter('all');
  };

  const baselineById = useMemo(() => {
    const m = new Map<string, Task>();
    baselineTasks.forEach(bt => m.set(String(bt.id), bt));
    return m;
  }, [baselineTasks]);

  const dateFilteredTasks = useMemo(() => {
    const baseTasks = tasks.filter(t => !t.level || t.level.toLowerCase().trim() !== 'checklist');
    if (!dateFilters.startDate && !dateFilters.endDate) {
      return baseTasks;
    }
    return baseTasks.filter(task => {
      const bl = resolveBaselineTask(task, baselineById);
      const taskStartDate = new Date(getAnchorStart(task, bl) + 'T00:00:00');
      const taskDueDate = new Date(getAnchorDue(task, bl) + 'T00:00:00');
      const filterStartDate = dateFilters.startDate ? new Date(dateFilters.startDate + 'T00:00:00') : null;
      const filterEndDate = dateFilters.endDate ? new Date(dateFilters.endDate + 'T00:00:00') : null;

      const matchesStartDate = !filterStartDate || taskDueDate >= filterStartDate;
      const matchesEndDate = !filterEndDate || taskStartDate <= filterEndDate;

      return matchesStartDate && matchesEndDate;
    });
  }, [tasks, dateFilters, baselineById]);

  const dateFilteredBaselineTasks = useMemo(() => {
    const baseBaselineTasks = baselineTasks.filter(t => !t.level || t.level.toLowerCase().trim() !== 'checklist');
    if (!dateFilters.startDate && !dateFilters.endDate) {
      return baseBaselineTasks;
    }
    return baseBaselineTasks.filter(task => {
      const bl = resolveBaselineTask(task, baselineById);
      const taskStartDate = new Date(getAnchorStart(task, bl) + 'T00:00:00');
      const taskDueDate = new Date(getAnchorDue(task, bl) + 'T00:00:00');
      const filterStartDate = dateFilters.startDate ? new Date(dateFilters.startDate + 'T00:00:00') : null;
      const filterEndDate = dateFilters.endDate ? new Date(dateFilters.endDate + 'T00:00:00') : null;

      const matchesStartDate = !filterStartDate || taskDueDate >= filterStartDate;
      const matchesEndDate = !filterEndDate || taskStartDate <= filterEndDate;

      return matchesStartDate && matchesEndDate;
    });
  }, [baselineTasks, dateFilters, baselineById]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return dateFilteredTasks;

    return dateFilteredTasks.filter(task => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bl = resolveBaselineTask(task, baselineById);
      const dueDate = new Date(getAnchorDue(task, bl) + 'T00:00:00');
      const isOverdue = dueDate < today && task.status !== TaskStatus.Completed;

      if (statusFilter === 'overdue') {
        return isOverdue;
      }

      if (statusFilter === 'rescheduled') {
        return taskCurrentDiffersFromInitialPlan(task, bl);
      }

      if (statusFilter === TaskStatus.Completed) {
        return task.status === TaskStatus.Completed;
      } else {
        // 'Em Andamento' / 'A Iniciar': Mostrar somente as que NÃO estão atrasadas
        return task.status === statusFilter && !isOverdue;
      }
    });
  }, [dateFilteredTasks, baselineById, statusFilter]);

  // Sincronizar baseline apenas com filtros de data, manter baseline original para comparação em gráficos de curva
  const filteredBaselineTasks = dateFilteredBaselineTasks;

  const handleStatusSelect = (status: any) => {
    setStatusFilter(status);
  };

  // --- NOVA LÓGICA PPC SEMANAL (WAR ROOM) ---
  const weeklyData = useMemo(() => {
    const tasksToUse = dateFilteredTasks;
    if (tasksToUse.length === 0) return [];

    const start = new Date(Math.min(...tasksToUse.map(t => new Date(t.startDate).getTime())));
    const end = new Date(Math.max(...tasksToUse.map(t => new Date(t.dueDate).getTime())));

    const weeks: { [key: string]: { planned: number; completed: number } } = {};

    tasksToUse.forEach(task => {
      const taskDueDate = new Date(task.dueDate + 'T23:59:59');
      if (taskDueDate >= start && taskDueDate <= end) {
        const d = new Date(taskDueDate);
        d.setDate(d.getDate() - d.getDay()); // Domingo
        const weekKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!weeks[weekKey]) weeks[weekKey] = { planned: 0, completed: 0 };
        weeks[weekKey].planned += 1;
        if (task.status === TaskStatus.Completed && task.actualEndDate) {
          const actualEnd = new Date(task.actualEndDate + 'T00:00:00');
          const dueLimit = new Date(task.dueDate + 'T23:59:59');
          if (actualEnd <= dueLimit) {
            weeks[weekKey].completed += 1;
          }
        }
      }
    });

    return Object.keys(weeks).sort((a, b) => {
      const [da, ma] = a.split('/').map(Number);
      const [db, mb] = b.split('/').map(Number);
      return (ma * 100 + da) - (mb * 100 + db);
    }).map(week => ({
      name: `${week}`,
      ppc: weeks[week].planned > 0 ? Math.round((weeks[week].completed / weeks[week].planned) * 100) : 0,
    }));
  }, [dateFilteredTasks]);

  const averagePpc = useMemo(() => {
    if (weeklyData.length === 0) return 0;
    return Math.round(weeklyData.reduce((acc, d) => acc + d.ppc, 0) / weeklyData.length);
  }, [weeklyData]);

  // --- NOVA LÓGICA PPC ACUMULADO (WAR ROOM) ---
  const accumulatedData = useMemo(() => {
    const tasksToUse = dateFilteredTasks;
    if (tasksToUse.length === 0) return [];

    const tasksByWeek: { weekStart: Date; weekEnd: Date; key: string; total: number; completed: number }[] = [];
    const allDates = tasksToUse.flatMap(t => [new Date(t.startDate), new Date(t.dueDate)]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    const current = new Date(minDate);
    current.setDate(current.getDate() - current.getDay());

    while (current <= maxDate) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const key = current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      let total = 0, completed = 0;
      tasksToUse.forEach(task => {
        const dueDate = new Date(task.dueDate + 'T00:00:00');
        if (dueDate <= weekEnd) {
          total++;
          if (task.status === TaskStatus.Completed) completed++;
        }
      });
      if (total > 0) {
        tasksByWeek.push({ weekStart: new Date(current), weekEnd: new Date(weekEnd), key, total, completed });
      }
      current.setDate(current.getDate() + 7);
    }

    const totalTasksCount = tasksToUse.length;
    return tasksByWeek.map(week => {
      return {
        name: `${week.key}`,
        planejado: Math.round((week.total / totalTasksCount) * 100),
        realizado: Math.round((week.completed / totalTasksCount) * 100),
      };
    });
  }, [dateFilteredTasks]);

  return (
    <div className="flex h-screen bg-[#060a12] overflow-hidden">
      <Sidebar
        user={user}
        activeScreen="reports"
        onNavigateToHome={onNavigateToHome}
        onNavigateToDashboard={onNavigateToDashboard}
        onNavigateToReports={() => { }}
        onNavigateToBaseline={onNavigateToBaseline}
        onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
        onNavigateToAnalysis={onNavigateToAnalysis}
        onNavigateToLean={onNavigateToLean}
        onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToMonitoringControl={onNavigateToMonitoringControl}
        onNavigateToWarRoom={onNavigateToWarRoom}
        onNavigateToPodcast={onNavigateToPodcast}
        onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
        onNavigateToOrgChart={onNavigateToOrgChart}
        onNavigateToOrgSummary={onNavigateToOrgSummary}
        onNavigateToVisualControl={onNavigateToVisualControl}
        onNavigateToSystem={onNavigateToSystem}
        onUpgradeClick={onUpgradeClick}
        onAddTask={onAddTask}
      />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
        <Header
          user={user}
          onLogout={handleLogout}
          onNavigateToHome={onNavigateToHome}
          onNavigateToDashboard={onNavigateToDashboard}
          onNavigateToReports={() => { }}
          onNavigateToBaseline={onNavigateToBaseline}
          onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
          onNavigateToAnalysis={onNavigateToAnalysis}
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
          activeScreen="reports"
        />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 animate-slide-up animate-stagger-2">
          <div className="max-w-screen-2xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic text-brand-accent">
                  Dashboards de Produção
                </h2>
                <p className="text-sm text-brand-med-gray font-medium mt-1 uppercase tracking-widest">Análise detalhada e indicadores de performance</p>
              </div>
              <button
                onClick={onNavigateToDashboard}
                className="group flex items-center gap-2 bg-[#111827]/80 text-white px-5 py-2.5 rounded-xl hover:bg-brand-accent smooth-transition font-bold border border-white/5 shadow-xl hover:-translate-x-1"
              >
                <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Voltar ao Quadro
              </button>
            </div>

            {/* Filters Panel */}
            <div className="bg-[#111827]/60 backdrop-blur-md p-5 rounded-2xl mb-8 border border-white/5 shadow-2xl animate-slide-up animate-stagger-1 hover:border-brand-accent/20 smooth-transition">
              <div className="flex flex-col md:flex-row items-end gap-6">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-3.5 bg-brand-accent rounded-full pulse-neon"></div>
                    <h4 className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Filtrar por Período</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FilterInput name="startDate" label="Data de Início" value={dateFilters.startDate} onChange={handleFilterChange} type="date" />
                    <FilterInput name="endDate" label="Data de Término" value={dateFilters.endDate} onChange={handleFilterChange} type="date" />
                  </div>
                </div>
                <button onClick={clearFilters} className="flex items-center justify-center gap-2 bg-white/5 text-brand-med-gray px-6 py-3 rounded-xl hover:bg-red-500/20 hover:text-red-400 smooth-transition h-11 border border-white/5 font-black text-[10px] uppercase tracking-widest">
                  <ClearIcon className="w-4 h-4" />
                  Limpar Filtros
                </button>
              </div>
            </div>

            {/* Quick Metrics (Dynamic Row) */}
            <section className="mb-12 space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-brand-accent rounded-full"></div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest leading-none">Visão Geral do Projeto</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                <DashboardSummary tasks={dateFilteredTasks} baselineTasks={baselineTasks} onStatusSelect={handleStatusSelect} activeStatus={statusFilter} />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-8 mb-12 animate-slide-up animate-stagger-2">
              <div className="bg-[#111827]/40 backdrop-blur-sm p-8 rounded-2xl border border-white/5 shadow-xl hover-shine relative overflow-hidden group">
                <h4 className="text-xs font-black text-brand-accent mb-6 uppercase tracking-widest border-b border-white/5 pb-2">Distribuição por Status</h4>
                <div className="h-[400px]">
                  <StatusChart tasks={filteredTasks} />
                </div>
              </div>
            </div>

            {/* Novos Gráficos PPC (Curva e Acumulado) - Estilo War Room */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-slide-up animate-stagger-3">
              {/* Lado Esquerdo: Curva PPC */}
              <div className="bg-[#111827]/60 backdrop-blur-md p-8 rounded-[2rem] border border-white/5 shadow-2xl hover:border-brand-accent/20 transition-all group overflow-hidden relative">
                <div className="flex justify-between items-center mb-8 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-brand-accent rounded-full shadow-[0_0_15px_rgba(227,90,16,0.5)]"></div>
                    <h4 className="text-xl font-black text-white uppercase tracking-widest">Curva PPC</h4>
                  </div>
                  <div className="bg-brand-accent/10 px-4 py-2 rounded-2xl border border-brand-accent/20 backdrop-blur-sm">
                    <span className="text-brand-accent font-black text-2xl">{averagePpc}%</span>
                    <span className="text-[10px] text-gray-500 uppercase font-bold ml-2 tracking-widest">Média</span>
                  </div>
                </div>

                <div className="h-[400px] relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        tick={{ fontSize: 12, fontWeight: '700', fill: '#94a3b8' }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="#64748b" 
                        tick={{ fontSize: 12, fontWeight: '700', fill: '#94a3b8' }} 
                        domain={[0, 100]} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ 
                          backgroundColor: '#0a1628', 
                          border: '1px solid rgba(227,90,16,0.2)', 
                          borderRadius: '1.25rem', 
                          fontSize: '11px',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                        }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <ReferenceLine y={averagePpc} stroke="#e35a10" strokeDasharray="5 5" strokeWidth={2} />
                      <Bar dataKey="ppc" name="PPC %" radius={[6, 6, 0, 0]} barSize={35}>
                        {weeklyData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.ppc >= 80 ? '#22c55e' : entry.ppc >= 50 ? '#eab308' : '#ef4444'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lado Direito: PPC Acumulado */}
              <div className="bg-[#111827]/60 backdrop-blur-md p-8 rounded-[2rem] border border-white/5 shadow-2xl hover:border-blue-500/20 transition-all group overflow-hidden relative">
                <div className="flex items-center gap-3 mb-8 relative z-10">
                  <div className="w-1.5 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                  <h4 className="text-xl font-black text-white uppercase tracking-widest">PPC Acumulado</h4>
                </div>

                <div className="h-[400px] relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={accumulatedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPlanejado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        tick={{ fontSize: 12, fontWeight: '700', fill: '#94a3b8' }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="#64748b" 
                        tick={{ fontSize: 12, fontWeight: '700', fill: '#94a3b8' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => `${v}%`}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: '#0a1628', 
                          border: '1px solid rgba(59,130,246,0.2)', 
                          borderRadius: '1.25rem',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', textTransform: 'uppercase', fontSize: '10px', fontWeight: 'bold' }} />
                      <Area
                        type="monotone"
                        dataKey="planejado"
                        name="Planejado"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPlanejado)"
                      />
                      <Area
                        type="monotone"
                        dataKey="realizado"
                        name="Realizado"
                        stroke="#22c55e"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#colorRealizado)"
                        connectNulls={true}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
