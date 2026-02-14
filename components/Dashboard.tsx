import React, { useState, useMemo } from 'react';
import { User, Task, TaskStatus } from '../types';
import { useData } from '../context/DataProvider';
import Header from './Header';
import DashboardSummary from './DashboardSummary';
import PlusIcon from './icons/PlusIcon';
import ChartIcon from './icons/ChartIcon';
import PrintIcon from './icons/PrintIcon';
import TaskListView from './TaskListView';
import ClearIcon from './icons/ClearIcon';
import BaselineIcon from './icons/BaselineIcon';
import ScheduleIcon from './icons/ScheduleIcon';
import ManagementIcon from './icons/ManagementIcon';
import LeanIcon from './icons/LeanIcon';
import ConstructionIcon from './icons/ConstructionIcon';
import FileTextIcon from './icons/FileTextIcon';
import FilterInput from './ui/FilterInput';
import FilterSelect from './ui/FilterSelect';

type SortKey = keyof Task | 'none';
type SortDirection = 'asc' | 'desc';
type StatusFilter = TaskStatus | 'all' | 'overdue';


interface DashboardProps {
  onOpenModal: (task: Task | null) => void;
  onOpenRdoModal: () => void;
  onNavigateToReports: () => void;
  onNavigateToBaseline: () => void;
  onNavigateToCurrentSchedule: () => void;
  onNavigateToAnalysis: () => void;
  onNavigateToLean: () => void;
  onUpgradeClick: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const initialFilters = {
  status: 'all' as StatusFilter,
  assignee: '',
  discipline: '',
  level: '',
  location: '',
  corte: '',
  support: '',
  startDate: '',
  endDate: '',
};

const Dashboard: React.FC<DashboardProps> = ({ onOpenModal, onOpenRdoModal, onNavigateToReports, onNavigateToBaseline, onNavigateToCurrentSchedule, onNavigateToAnalysis, onNavigateToLean, onUpgradeClick, showToast }) => {
  const { currentUser: user, tasks, baselineTasks, signOut, deleteTask } = useData();
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'dueDate', direction: 'asc' });

  if (!user) return null;
  const showFullMenu = user.role !== 'Executor';
  const canWritePlanning = user.role === 'Master' || user.role === 'Planejador';
  const canUseAI = user.role === 'Master' || user.role === 'Gerenciador';

  const handleLogout = async () => {
    const { success, error } = await signOut();
    if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
  };

  const handleDeleteTask = async (taskId: string) => {
    const { success, error } = await deleteTask(taskId);
    if (success) showToast('Tarefa deletada.', 'success');
    else if (error) showToast(`Erro ao deletar tarefa: ${error}`, 'error');
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusSelect = (status: StatusFilter) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const clearFilters = () => {
    setFilters(initialFilters);
  };

  const uniqueOptions = useMemo(() => {
    const assignees = new Set<string>();
    const disciplines = new Set<string>();
    const levels = new Set<string>();
    const locations = new Set<string>();
    const cortes = new Set<string>();
    const supports = new Set<string>();

    tasks.forEach(task => {
      if (task.assignee) assignees.add(task.assignee);
      if (task.discipline) disciplines.add(task.discipline);
      if (task.level) levels.add(task.level);
      if (task.location) locations.add(task.location);
      if (task.corte) cortes.add(task.corte);
      if (task.support) supports.add(task.support);
    });

    return {
      assignee: Array.from(assignees).sort(),
      discipline: Array.from(disciplines).sort(),
      level: Array.from(levels).sort(),
      location: Array.from(locations).sort(),
      corte: Array.from(cortes).sort(),
      support: Array.from(supports).sort(),
    };
  }, [tasks]);

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.dueDate + 'T00:00:00');
      const isOverdue = dueDate < today && task.status !== TaskStatus.Completed;

      let matchesStatus;
      if (filters.status === 'all') {
        matchesStatus = true;
      } else if (filters.status === 'overdue') {
        matchesStatus = isOverdue;
      } else {
        matchesStatus = task.status === filters.status;
      }

      const matchesAssignee = filters.assignee === '' || task.assignee.toLowerCase().includes(filters.assignee.toLowerCase());
      const matchesDiscipline = filters.discipline === '' || task.discipline.toLowerCase().includes(filters.discipline.toLowerCase());
      const matchesLevel = filters.level === '' || task.level.toLowerCase().includes(filters.level.toLowerCase());
      const matchesLocation = filters.location === '' || task.location.toLowerCase().includes(filters.location.toLowerCase());
      const matchesCorte = filters.corte === '' || (task.corte && task.corte.toLowerCase().includes(filters.corte.toLowerCase()));
      const matchesSupport = filters.support === '' || task.support.toLowerCase().includes(filters.support.toLowerCase());

      const taskStartDate = new Date(task.startDate + 'T00:00:00');
      const taskDueDate = new Date(task.dueDate + 'T00:00:00');

      const filterStartDate = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null;
      const filterEndDate = filters.endDate ? new Date(filters.endDate + 'T00:00:00') : null;

      const matchesStartDate = !filterStartDate || taskStartDate >= filterStartDate;
      const matchesEndDate = !filterEndDate || taskDueDate <= filterEndDate;

      return matchesStatus && matchesAssignee && matchesDiscipline && matchesLevel && matchesLocation && matchesCorte && matchesSupport && matchesStartDate && matchesEndDate;
    });

    if (sortConfig.key !== 'none') {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Task];
        const bValue = b[sortConfig.key as keyof Task];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [tasks, filters, sortConfig]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handlePrint = () => {
    window.print();
  }


  return (
    <div className="flex h-screen bg-[#060a12] overflow-hidden">
      {/* Sidebar Navigation - Fixed on left for desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-[#0a0f18] border-r border-white/5 non-printable transition-all duration-300">
        <div className="p-8 flex-1">
          <div className="flex flex-col mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/20">
                <ConstructionIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tighter">LEAN</h1>
            </div>
            <p className="text-[10px] text-brand-accent font-black uppercase tracking-[0.2em] ml-13 mt-[-4px] ml-[52px]">SOLUTION • V1.0</p>
          </div>

          <nav className="space-y-2">
            <h3 className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mb-4 ml-2">Menu Principal</h3>
            <NavButton active icon={<ChartIcon className="w-5 h-5" />} label="Painel de Controle" onClick={() => { }} />
            {showFullMenu && (
              <>
                <NavButton icon={<BaselineIcon className="w-5 h-5" />} label="Linha Base" onClick={onNavigateToBaseline} />
                <NavButton icon={<ScheduleIcon className="w-5 h-5" />} label="Cronograma Corrente" onClick={onNavigateToCurrentSchedule} />
                <NavButton icon={<ChartIcon className="w-5 h-5" />} label="Dashboards" onClick={onNavigateToReports} />
                <NavButton icon={<ManagementIcon className="w-5 h-5" />} label="Painel Gerencial" onClick={onNavigateToAnalysis} />
                <NavButton icon={<LeanIcon className="w-5 h-5 text-brand-accent" />} label="Sistema Lean" onClick={onNavigateToLean} />
              </>
            )}
          </nav>
        </div>

        <div className="p-6 bg-brand-darkest/50 animate-slide-up animate-stagger-4 mt-auto">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 smooth-transition group cursor-pointer hover-shine relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-brand-accent flex items-center justify-center text-white font-black shadow-lg group-hover:rotate-6 smooth-transition">
              {user.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate leading-none">{user.fullName}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-bold text-brand-med-gray uppercase tracking-wider">{user.role}</p>
                <button
                  onClick={onUpgradeClick}
                  className="text-[8px] bg-brand-accent/20 text-brand-accent border border-brand-accent/30 px-1 py-0.5 rounded hover:bg-brand-accent hover:text-white transition-all font-black uppercase"
                >
                  Upgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
        <Header
          user={user}
          onLogout={handleLogout}
          onNavigateToDashboard={() => { }}
          onNavigateToReports={onNavigateToReports}
          onNavigateToBaseline={onNavigateToBaseline}
          onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
          onNavigateToAnalysis={onNavigateToAnalysis}
          onNavigateToLean={onNavigateToLean}
          onUpgradeClick={onUpgradeClick}
          activeScreen="dashboard"
        />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 animate-slide-up animate-stagger-2">
          <div className="max-w-screen-2xl mx-auto space-y-8">

            {/* Action Bar - Top Row */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 non-printable">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">Painel de Controle</h2>
                <p className="text-sm text-brand-med-gray">Gestão de tarefas e controle de produção diário.</p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                {(canWritePlanning || user.role === 'Gerenciador') && (
                  <button
                    onClick={canUseAI ? onOpenRdoModal : () => showToast('Upgrade necessário para usar IA.', 'error')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#121c2e] text-cyan-400 px-5 py-3 rounded-xl hover:bg-cyan-500 hover:text-white transition-all duration-300 font-bold border border-cyan-500/20 shadow-xl shadow-cyan-500/5 group"
                  >
                    <FileTextIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>Gerar RDO com IA</span>
                  </button>
                )}
                {canWritePlanning && (
                  <button
                    onClick={() => onOpenModal(null)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-brand-accent text-white px-6 py-3 rounded-xl hover:bg-[#e35a10] transition-all duration-300 font-bold shadow-xl shadow-brand-accent/20 border border-white/10"
                  >
                    <PlusIcon className="w-5 h-5" />
                    <span>Nova Tarefa</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dash Analytics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 non-printable">
              <DashboardSummary tasks={tasks} onStatusSelect={handleStatusSelect} activeStatus={filters.status} />
            </div>

            {/* Interactive Filters Glass Panel */}
            <div className="bg-[#111827]/60 backdrop-blur-sm p-4 rounded-xl border border-white/5 shadow-2xl space-y-4 non-printable smooth-transition hover:border-brand-accent/20">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-brand-accent rounded-full pulse-neon"></div>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Filtros Inteligentes</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={clearFilters} className="text-[10px] font-bold text-brand-med-gray hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5">
                    <ClearIcon className="w-3.5 h-3.5" />
                    Limpar Tudo
                  </button>
                  <button onClick={handlePrint} className="text-[10px] font-bold text-brand-med-gray hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5">
                    <PrintIcon className="w-3.5 h-3.5" />
                    Imprimir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 overflow-x-auto custom-scrollbar pb-1">
                <FilterInput name="startDate" label="Início" value={filters.startDate} onChange={handleFilterChange} type="date" />
                <FilterInput name="endDate" label="Fim" value={filters.endDate} onChange={handleFilterChange} type="date" />
                <FilterSelect name="assignee" label="Resp." value={filters.assignee} onChange={handleFilterChange} options={uniqueOptions.assignee} />
                <FilterSelect name="discipline" label="Disc." value={filters.discipline} onChange={handleFilterChange} options={uniqueOptions.discipline} />
                <FilterSelect name="level" label="Nível" value={filters.level} onChange={handleFilterChange} options={uniqueOptions.level} />
                <FilterSelect name="location" label="Local" value={filters.location} onChange={handleFilterChange} options={uniqueOptions.location} />
                <FilterSelect name="corte" label="Corte" value={filters.corte} onChange={handleFilterChange} options={uniqueOptions.corte} />
              </div>
            </div>

            {/* Task Table Container */}
            <div className="printable-area bg-[#111827]/40 rounded-2xl border border-white/5 overflow-hidden shadow-inner animate-slide-up animate-stagger-3">
              <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-white/5">
                <div className="w-1.5 h-6 bg-brand-accent rounded-full"></div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">Programação Semanal</h3>
                <span className="text-[10px] font-bold text-brand-med-gray bg-white/5 px-2 py-1 rounded-full">{filteredAndSortedTasks.length} tarefas</span>
              </div>
              <TaskListView
                tasks={filteredAndSortedTasks}
                baselineTasks={baselineTasks}
                onEditTask={onOpenModal}
                onDeleteTask={handleDeleteTask}
                onSort={handleSort}
                sortConfig={sortConfig}
                userRole={user.role}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Componente auxiliar para navegação
const NavButton: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }> = ({ icon, label, onClick, active }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${active
      ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-bold'
      : 'text-brand-med-gray hover:bg-white/5 hover:text-white font-medium'
      }`}
  >
    <div className={`transition-transform duration-300 group-hover:scale-110 ${active ? 'text-white' : 'text-brand-accent/70'}`}>
      {icon}
    </div>
    <span className="text-sm tracking-tight whitespace-nowrap">{label}</span>
  </button>
);

export default Dashboard;