import React, { useState, useMemo } from 'react';
import { User, Task, TaskStatus } from '../types';
import { useData } from '../context/DataProvider';
import Header from './Header';
import DashboardSummary from './DashboardSummary';
import StatusChart from './StatusChart';
import TimelineView from './TimelineView';
import AssigneeSummaryChart from './AssigneeSummaryChart';
import CumulativeProgressChart from './CumulativeProgressChart';
import ClearIcon from './icons/ClearIcon';
import FilterInput from './ui/FilterInput';

interface ReportsPageProps {
  onNavigateToDashboard: () => void;
  onNavigateToReports: () => void;
  onNavigateToBaseline: () => void;
  onNavigateToCurrentSchedule: () => void;
  onNavigateToAnalysis: () => void;
  onNavigateToLean: () => void;
  onNavigateToLeanConstruction: () => void;
  onNavigateToCost: () => void;
  onNavigateToHome?: () => void;
  onUpgradeClick: () => void;
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
  onNavigateToLeanConstruction,
  onNavigateToCost,
  onNavigateToHome,
  onUpgradeClick,
  showToast
}) => {
  const { currentUser: user, tasks, baselineTasks, signOut } = useData();
  const [dateFilters, setDateFilters] = useState({ startDate: '', endDate: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | TaskStatus>('all');

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

  const filterTasksByDate = (tasksToFilter: Task[]) => {
    if (!dateFilters.startDate && !dateFilters.endDate) {
      return tasksToFilter;
    }
    return tasksToFilter.filter(task => {
      const taskStartDate = new Date(task.startDate + 'T00:00:00');
      const taskDueDate = new Date(task.dueDate + 'T00:00:00');
      const filterStartDate = dateFilters.startDate ? new Date(dateFilters.startDate + 'T00:00:00') : null;
      const filterEndDate = dateFilters.endDate ? new Date(dateFilters.endDate + 'T00:00:00') : null;

      // Lógica de Overlap: 
      // Tarefa deve terminar DEPOIS do início do filtro (se houver início)
      const matchesStartDate = !filterStartDate || taskDueDate >= filterStartDate;
      // Tarefa deve começar ANTES do fim do filtro (se houver fim)
      const matchesEndDate = !filterEndDate || taskStartDate <= filterEndDate;

      return matchesStartDate && matchesEndDate;
    });
  };

  const dateFilteredTasks = useMemo(() => filterTasksByDate(tasks), [tasks, dateFilters]);
  const dateFilteredBaselineTasks = useMemo(() => filterTasksByDate(baselineTasks), [baselineTasks, dateFilters]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return dateFilteredTasks;

    return dateFilteredTasks.filter(task => {
      if (statusFilter === 'overdue') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.dueDate + 'T00:00:00');
        return dueDate < today && task.status !== TaskStatus.Completed;
      }
      return task.status === statusFilter;
    });
  }, [dateFilteredTasks, statusFilter]);

  // Sincronizar baseline apenas com filtros de data, manter baseline original para comparação em gráficos de curva
  const filteredBaselineTasks = dateFilteredBaselineTasks;

  const handleStatusSelect = (status: any) => {
    setStatusFilter(status);
  };

  return (
    <div className="flex flex-col h-screen bg-brand-darkest/90">
      <Header
        user={user}
        onLogout={handleLogout}
        onNavigateToDashboard={onNavigateToDashboard}
        onNavigateToReports={() => { }}
        onNavigateToBaseline={onNavigateToBaseline}
        onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
        onNavigateToAnalysis={onNavigateToAnalysis}
        onNavigateToLean={onNavigateToLean}
        onNavigateToLeanConstruction={onNavigateToLeanConstruction}
        onNavigateToCost={onNavigateToCost}
        onUpgradeClick={onUpgradeClick}
        activeScreen="reports"
      />

      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-brand-darkest/50 relative">
        {/* Background decorative light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-accent/5 blur-[120px] pointer-events-none rounded-full"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 animate-slide-up">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                Dashboards de <span className="text-brand-accent">Produção</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <DashboardSummary tasks={dateFilteredTasks} onStatusSelect={handleStatusSelect} activeStatus={statusFilter} />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 animate-slide-up animate-stagger-2">
            <div className="bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl hover-shine relative overflow-hidden group">
              <h4 className="text-xs font-black text-brand-accent mb-6 uppercase tracking-widest border-b border-white/5 pb-2">Distribuição por Status</h4>
              <div className="h-[300px]">
                <StatusChart tasks={filteredTasks} />
              </div>
            </div>

            <div className="bg-[#111827]/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl hover-shine relative overflow-hidden group">
              <h4 className="text-xs font-black text-brand-accent mb-6 uppercase tracking-widest border-b border-white/5 pb-2">Top Performance por Responsável</h4>
              <div className="h-[300px]">
                <AssigneeSummaryChart tasks={filteredTasks} />
              </div>
            </div>
          </div>

          <div className="space-y-12 animate-slide-up animate-stagger-3">
            <section className="bg-[#111827]/40 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Cronograma de Produção (Gantt)</h4>
                {statusFilter !== 'all' && (
                  <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-3 py-1 rounded-full border border-brand-accent/30 font-black uppercase tracking-tighter animate-pulse">
                    Filtro Ativo: {statusFilter}
                  </span>
                )}
              </div>
              <div className="p-4 overflow-x-auto">
                <TimelineView tasks={filteredTasks} baselineTasks={filteredBaselineTasks} onEditTask={() => { }} />
              </div>
            </section>

            <section className="bg-[#111827]/60 backdrop-blur-md p-8 rounded-2xl border border-white/5 shadow-2xl hover:border-brand-accent/10 transition-colors w-full">
              <h4 className="text-xs font-black text-brand-accent mb-8 uppercase tracking-[3px] text-center italic">Avanço Físico Acumulado (PPC)</h4>
              <div className="h-[500px]">
                <CumulativeProgressChart
                  tasks={filteredTasks}
                  baselineTasks={filteredBaselineTasks}
                  startDate={dateFilters.startDate}
                  endDate={dateFilters.endDate}
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;