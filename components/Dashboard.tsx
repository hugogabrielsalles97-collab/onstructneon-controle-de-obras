
import React, { useState, useMemo, useCallback } from 'react';
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
import Sidebar from './Sidebar';
import FilterInput from './ui/FilterInput';
import FilterSelect from './ui/FilterSelect';
import AlertIcon from './icons/AlertIcon';
import ConfirmModal from './ConfirmModal';
import { useOrgMembers } from '../hooks/dataHooks';

type SortKey = keyof Task | 'none';
type SortDirection = 'asc' | 'desc';
type StatusFilter = TaskStatus | 'all' | 'overdue';


interface DashboardProps {
  onOpenModal: (task: Task | null) => void;
  onOpenRdoModal: () => void;
  onNavigateToHome?: () => void;
  onNavigateToReports: () => void;
  onNavigateToBaseline: () => void;
  onNavigateToCurrentSchedule: () => void;
  onNavigateToAnalysis: () => void;
  onNavigateToLean: () => void;
  onNavigateToLeanConstruction: () => void;
  onNavigateToWarRoom: () => void;
  onNavigateToCost: () => void;
  onNavigateToPodcast: () => void;
  onNavigateToCheckoutSummary: () => void;
  onNavigateToOrgChart?: () => void;
  onNavigateToOrgSummary?: () => void;
  onNavigateToTeams?: () => void;
  onNavigateToVisualControl?: () => void;
  onNavigateToSystem?: () => void;
  onUpgradeClick: () => void;
  onAddTask?: () => void;
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
  engineer: '',
};

const Dashboard: React.FC<DashboardProps> = ({ onOpenModal, onOpenRdoModal, onNavigateToHome, onNavigateToReports, onNavigateToBaseline, onNavigateToCurrentSchedule, onNavigateToAnalysis, onNavigateToLean, onNavigateToLeanConstruction, onNavigateToWarRoom, onNavigateToPodcast, onNavigateToCost, onNavigateToCheckoutSummary, onNavigateToOrgChart, onNavigateToOrgSummary, onNavigateToTeams, onNavigateToVisualControl, onNavigateToSystem, onUpgradeClick, onAddTask, showToast }) => {
  const { currentUser: user, tasks, allUsers, baselineTasks, signOut, deleteTask, isLoadingTasks } = useData();
  const { data: orgMembers } = useOrgMembers();
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'dueDate', direction: 'asc' });

  if (!user) return null;

  // ==== ACL: Filtragem por Perfil ====
  // Executores veem apenas o que lhes foi alocado E que NÃO foi concluído
  // Outros cargos (Master, Gerenciador, Planejador) veem tudo
  const visibleTasks = useMemo(() => {
    if (user.role === 'Executor') {
      return tasks.filter(t => t.assignee === user.fullName && t.status !== TaskStatus.Completed);
    }
    return tasks;
  }, [tasks, user.role, user.fullName]);

  const showFullMenu = user.role !== 'Executor';
  const canWritePlanning = user.role === 'Master' || user.role === 'Planejador';
  const canUseAI = user.role === 'Master' || user.role === 'Gerenciador';

  const handleLogout = async () => {
    const { success, error } = await signOut();
    if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
  };

  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ==== Availability Checker ====
  const [showAvailability, setShowAvailability] = useState(false);
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [availabilityEngineer, setAvailabilityEngineer] = useState('');

  const engineersList = useMemo(() => {
    if (!orgMembers) return [];
    return orgMembers.filter(m => (m.role || '').toLowerCase().includes('engenheiro')).sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMembers]);

  const freeEncarregadosData = useMemo(() => {
    if (!availabilityDate || !orgMembers) return [];

    // 0. Filter by chosen Engineer (traverse down to find all descendants of the selected engineer)
    let allowedEncarregadosIds: Set<string> | null = null;
    if (availabilityEngineer) {
      const eng = orgMembers.find(m => m.name === availabilityEngineer && (m.role || '').toLowerCase().includes('engenheiro'));
      if (eng) {
        allowedEncarregadosIds = new Set();
        const findDescendants = (parentId: string) => {
          const children = orgMembers.filter(m => m.parent_id === parentId);
          children.forEach(c => {
            allowedEncarregadosIds!.add(c.id);
            findDescendants(c.id);
          });
        };
        findDescendants(eng.id);
      } else {
        // engineer not found, don't show any encarregados
        allowedEncarregadosIds = new Set();
      }
    }

    // 1. Identify "busy" assignees via tasks in the selected date
    const busyAssignees = new Set(
      tasks
        .filter(t => t.status !== TaskStatus.Completed && t.startDate <= availabilityDate && t.dueDate >= availabilityDate)
        .map(t => t.assignee?.trim().toLowerCase())
    );

    // 2. Find orgMembers who are "Encarregado" but not "Encarregado de Frente"
    const encarregados = orgMembers.filter(m => {
      const roleLower = (m.role || '').toLowerCase();
      const isEncarregado = roleLower.includes('encarregado') && !roleLower.includes('frente');
      if (!isEncarregado) return false;

      if (allowedEncarregadosIds !== null && !allowedEncarregadosIds.has(m.id)) {
        return false;
      }
      return true;
    });

    // 3. Filter only those who are FREE
    const freeEncarregados = encarregados.filter(e => {
      const nameLower = (e.name || '').trim().toLowerCase();
      return !busyAssignees.has(nameLower);
    });

    // 4. For each free encarregado, gather their team summary
    return freeEncarregados.map(enc => {
      const counts: Record<string, number> = {};
      const processedIds = new Set<string>();

      const addDescendants = (parentId: string) => {
        const children = orgMembers.filter(m => m.parent_id === parentId);
        children.forEach(child => {
          if (!processedIds.has(child.id)) {
            processedIds.add(child.id);
            const roleKey = child.role.trim().toUpperCase();
            const count = child.quantity || 1;
            counts[roleKey] = (counts[roleKey] || 0) + count;
            addDescendants(child.id);
          }
        });
      };

      addDescendants(enc.id);

      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      return {
        id: enc.id,
        name: enc.name || 'Sem Nome',
        role: enc.role || 'Encarregado',
        counts,
        total
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

  }, [availabilityDate, availabilityEngineer, tasks, orgMembers]);

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    const { success, error } = await deleteTask(taskToDelete);
    if (success) showToast('Tarefa deletada.', 'success');
    else if (error) showToast(`Erro ao deletar tarefa: ${error}`, 'error');
    setIsDeleting(false);
    setTaskToDelete(null);
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
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

  // OTIMIZAÇÃO: Mapeamento de Engenheiros por Responsável (O(N) uma única vez)
  const engineerByAssigneeMap = useMemo(() => {
    if (!orgMembers || !allUsers) return new Map<string, string>();

    const map = new Map<string, string>();
    const memberById = new Map<string, typeof orgMembers[0]>();
    orgMembers.forEach(m => memberById.set(m.id, m));

    allUsers.forEach(u => {
      let currentMember = orgMembers.find(m => m.user_id === u.id || m.name === u.fullName);
      if (!currentMember) return;

      let parent = memberById.get(currentMember.parent_id || '');
      let topParent = null;

      while (parent) {
        if (parent.role.toLowerCase().includes('eng')) {
          map.set(u.fullName, parent.name);
          return;
        }
        if (!parent.parent_id) {
          topParent = parent;
          break;
        }
        parent = memberById.get(parent.parent_id);
      }
      if (topParent) map.set(u.fullName, topParent.name);
    });

    return map;
  }, [orgMembers, allUsers]);

  const uniqueOptions = useMemo(() => {
    const assignees = new Set<string>();
    const disciplines = new Set<string>();
    const levels = new Set<string>();
    const locations = new Set<string>();
    const cortes = new Set<string>();
    const supports = new Set<string>();
    const engineers = new Set<string>();

    visibleTasks.forEach(task => {
      if (task.assignee) {
        assignees.add(task.assignee);
        const eng = engineerByAssigneeMap.get(task.assignee);
        if (eng) engineers.add(eng);
      }
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
      engineer: Array.from(engineers).sort(),
    };
  }, [visibleTasks, engineerByAssigneeMap]);

  const filteredAndSortedTasks = useMemo(() => {
    const todayNum = new Date().setHours(0, 0, 0, 0);
    const filterStartDateNum = filters.startDate ? new Date(filters.startDate + 'T00:00:00').getTime() : null;
    const filterEndDateNum = filters.endDate ? new Date(filters.endDate + 'T00:00:00').getTime() : null;

    let filtered = visibleTasks.filter(task => {
      const taskDueDateNum = new Date(task.dueDate + 'T00:00:00').getTime();
      const isOverdue = taskDueDateNum < todayNum && task.status !== TaskStatus.Completed;

      let matchesStatus = true;
      if (filters.status === 'overdue') matchesStatus = isOverdue;
      else if (filters.status !== 'all') matchesStatus = task.status === filters.status;

      if (!matchesStatus) return false;

      // Filtros de texto (Case Insensitive)
      if (filters.assignee && !task.assignee.toLowerCase().includes(filters.assignee.toLowerCase())) return false;
      if (filters.discipline && !task.discipline.toLowerCase().includes(filters.discipline.toLowerCase())) return false;
      if (filters.level && !task.level.toLowerCase().includes(filters.level.toLowerCase())) return false;
      if (filters.location && !task.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
      if (filters.corte && (!task.corte || !task.corte.toLowerCase().includes(filters.corte.toLowerCase()))) return false;
      if (filters.support && !task.support.toLowerCase().includes(filters.support.toLowerCase())) return false;

      // Filtros de Data (usando timestamps numéricos para velocidade)
      if (filterStartDateNum) {
        const taskStartNum = new Date(task.startDate + 'T00:00:00').getTime();
        if (taskStartNum < filterStartDateNum) return false;
      }
      if (filterEndDateNum && taskDueDateNum > filterEndDateNum) return false;

      // Filtro de Engenheiro
      if (filters.engineer) {
        const eng = engineerByAssigneeMap.get(task.assignee);
        if (eng !== filters.engineer) return false;
      }

      return true;
    });

    if (sortConfig.key !== 'none') {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Task];
        const bValue = b[sortConfig.key as keyof Task];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [visibleTasks, filters, sortConfig, engineerByAssigneeMap]);

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
      <Sidebar
        user={user}
        activeScreen="dashboard"
        onNavigateToHome={onNavigateToHome}
        onNavigateToDashboard={() => { }}
        onNavigateToReports={onNavigateToReports}
        onNavigateToBaseline={onNavigateToBaseline}
        onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
        onNavigateToAnalysis={onNavigateToAnalysis}
        onNavigateToLean={onNavigateToLean}
        onNavigateToLeanConstruction={onNavigateToLeanConstruction}
        onNavigateToWarRoom={onNavigateToWarRoom}
        onNavigateToPodcast={onNavigateToPodcast}
        onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
        onNavigateToOrgChart={onNavigateToOrgChart}
        onNavigateToOrgSummary={onNavigateToOrgSummary}
        onNavigateToVisualControl={onNavigateToVisualControl}
        onNavigateToTeams={onNavigateToTeams}
        onNavigateToSystem={onNavigateToSystem}
        onUpgradeClick={onUpgradeClick}
        onAddTask={onAddTask}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
        <Header
          user={user}
          onLogout={handleLogout}
          onNavigateToHome={onNavigateToHome}
          onNavigateToDashboard={() => { }}
          onNavigateToReports={onNavigateToReports}
          onNavigateToBaseline={onNavigateToBaseline}
          onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
          onNavigateToAnalysis={onNavigateToAnalysis}
          onNavigateToLean={onNavigateToLean}
          onNavigateToLeanConstruction={onNavigateToLeanConstruction}
          onNavigateToWarRoom={onNavigateToWarRoom}
          onNavigateToPodcast={onNavigateToPodcast}
          onNavigateToCost={onNavigateToCost}
          onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
          onNavigateToOrgChart={onNavigateToOrgChart}
          onNavigateToOrgSummary={onNavigateToOrgSummary}
          onNavigateToVisualControl={onNavigateToVisualControl}
          onNavigateToTeams={onNavigateToTeams}
          onUpgradeClick={onUpgradeClick}
          activeScreen="dashboard"
        />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 animate-slide-up animate-stagger-2">
          <div className="max-w-screen-2xl mx-auto space-y-8">

            {/* Action Bar - Top Row */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 non-printable">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">Programação Semanal</h2>
                <p className="text-sm text-brand-med-gray">Gestão de tarefas e controle de produção diário.</p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                {(canWritePlanning || user.role === 'Gerenciador') && (
                  <button
                    onClick={canUseAI ? onOpenRdoModal : () => showToast('Upgrade necessário para usar IA.', 'error')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-brand-accent/10 text-brand-accent px-5 py-3 rounded-xl hover:bg-brand-accent hover:text-white transition-all duration-300 font-bold border border-brand-accent/20 shadow-xl shadow-brand-accent/5 group"
                  >
                    <FileTextIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>Gerar RDO com IA</span>
                  </button>
                )}
                {canWritePlanning && (
                  <>
                    <button
                      onClick={() => setShowAvailability(true)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1b2333]/80 text-gray-300 px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 font-bold border border-white/10 shadow-xl hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] hover:border-indigo-500/50"
                      title="Verificar Disponibilidade de Encarregados"
                    >
                      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="hidden sm:inline">Disponibilidade</span>
                    </button>

                    {showAvailability && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
                        <div className="bg-[#111827] border border-white/10 rounded-3xl shadow-2xl w-full max-w-5xl p-6 flex flex-col max-h-[90vh]">
                          <div className="flex justify-between items-start md:items-center border-b border-white/10 pb-4 mb-6 relative">
                            <div>
                              <h2 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-3 mb-1">
                                <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></span>
                                Disponibilidade de Encarregados
                              </h2>
                              <p className="text-xs text-brand-med-gray tracking-wide">
                                Encarregados livres na data selecionada (exclui encarregados de frente) e o contingente consolidado de cada uno.
                              </p>
                            </div>
                            <button onClick={() => setShowAvailability(false)} className="absolute top-0 right-0 md:relative text-gray-500 hover:text-white transition-colors bg-white/5 p-2 rounded-xl hover:bg-white/10 border border-white/5">
                              <ClearIcon className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Selecione a Data Estimada</label>
                              <input
                                type="date"
                                className="w-full bg-[#0a0f18] border border-white/10 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 shadow-inner custom-date-input"
                                value={availabilityDate}
                                onChange={e => setAvailabilityDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Filtrar por Engenheiro</label>
                              <select
                                className="w-full bg-[#0a0f18] border border-white/10 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 shadow-inner appearance-none custom-select"
                                value={availabilityEngineer}
                                onChange={e => setAvailabilityEngineer(e.target.value)}
                              >
                                <option value="">Todos os Engenheiros</option>
                                {engineersList.map(eng => (
                                  <option key={eng.id} value={eng.name}>{eng.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[300px]">
                            {!availabilityDate ? (
                              <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
                                <svg className="w-16 h-16 text-indigo-400 mb-4 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <p className="text-sm text-gray-300 font-bold uppercase tracking-widest">Selecione uma data acima para visualizar</p>
                              </div>
                            ) : freeEncarregadosData.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full opacity-80 py-20">
                                <svg className="w-16 h-16 text-orange-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <p className="text-sm font-bold text-orange-400 uppercase tracking-widest bg-orange-500/10 px-6 py-2 rounded-xl border border-orange-500/20">Nenhum Encarregado Livre</p>
                                <p className="text-xs text-brand-med-gray mt-3">Todos os encarregados estão alocados em alguma atividade.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {freeEncarregadosData.map(enc => (
                                  <div key={enc.id} className="bg-[#1b2333]/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col hover:border-indigo-500/40 hover:bg-[#1b2333]/60 transition-all duration-300 shadow-xl group">
                                    <div className="flex justify-between items-start mb-5">
                                      <div className="flex-1 pr-2">
                                        <h3 className="text-sm font-black text-white uppercase tracking-tight break-words leading-tight group-hover:text-indigo-400 transition-colors" title={enc.name}>{enc.name}</h3>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block mt-1">{enc.role}</span>
                                      </div>
                                      <div className="bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 flex flex-col items-center justify-center min-w-[3.5rem] shadow-inner flex-shrink-0">
                                        <span className="text-xs font-black text-indigo-400 leading-none mb-1">{enc.total}</span>
                                        <span className="text-[7px] text-gray-500 uppercase font-bold leading-none tracking-widest">Pessoas</span>
                                      </div>
                                    </div>

                                    <div className="flex-1 space-y-2 overflow-y-auto max-h-48 custom-scrollbar pr-1">
                                      {Object.entries(enc.counts).length > 0 ? (
                                        Object.entries(enc.counts).map(([role, qty]) => (
                                          <div key={role} className="flex justify-between items-center text-[11px] p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.02] hover:bg-white/[0.06] transition-colors">
                                            <span className="text-gray-300 truncate pr-2 font-medium" title={role}>{role}</span>
                                            <span className="font-black text-white px-2 py-0.5 bg-black/30 rounded-md border border-white/5">{qty}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="h-full flex items-center justify-center py-6 border border-dashed border-white/10 rounded-xl">
                                          <p className="text-[10px] text-gray-500 text-center italic font-medium uppercase tracking-widest">Sem equipe estruturada</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {canWritePlanning && (
                  <button
                    onClick={() => onOpenModal(null)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-brand-accent text-white px-6 py-3 rounded-xl hover:bg-[#e35a10] transition-all duration-300 font-bold shadow-xl shadow-brand-accent/20 border border-white/10 hover:shadow-[0_0_15px_rgba(235,90,16,0.5)] hover:border-[#eb5a10]/50"
                  >
                    <PlusIcon className="w-5 h-5" />
                    <span>Nova Tarefa</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dash Analytics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 non-printable">
              <DashboardSummary tasks={visibleTasks} onStatusSelect={handleStatusSelect} activeStatus={filters.status} />
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

              <div className="flex flex-wrap items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                <div className="flex-1 min-w-[120px]">
                  <FilterInput name="startDate" label="Início" value={filters.startDate} onChange={handleFilterChange} type="date" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <FilterInput name="endDate" label="Fim" value={filters.endDate} onChange={handleFilterChange} type="date" />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <FilterSelect name="engineer" label="Engenheiro" value={filters.engineer} onChange={handleFilterChange} options={uniqueOptions.engineer} />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <FilterSelect name="assignee" label="Resp." value={filters.assignee} onChange={handleFilterChange} options={uniqueOptions.assignee} />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <FilterSelect name="discipline" label="Disc." value={filters.discipline} onChange={handleFilterChange} options={uniqueOptions.discipline} />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <FilterSelect name="level" label="Nível" value={filters.level} onChange={handleFilterChange} options={uniqueOptions.level} />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <FilterSelect name="location" label="Local" value={filters.location} onChange={handleFilterChange} options={uniqueOptions.location} />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <FilterSelect name="corte" label="Corte" value={filters.corte} onChange={handleFilterChange} options={uniqueOptions.corte} />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <FilterSelect name="support" label="Apoio" value={filters.support} onChange={handleFilterChange} options={uniqueOptions.support} />
                </div>
              </div>
            </div>

            {/* Task Table Container */}
            <div className="printable-area bg-[#111827]/40 rounded-2xl border border-white/5 overflow-hidden shadow-inner animate-slide-up animate-stagger-3">
              <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-white/5">
                <div className="w-1.5 h-6 bg-brand-accent rounded-full"></div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">Programação Semanal</h3>
                <span className="text-[10px] font-bold text-brand-med-gray bg-white/5 px-2 py-1 rounded-full">{filteredAndSortedTasks.length} tarefas</span>
              </div>
              {isLoadingTasks && tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-brand-med-gray font-bold text-xs uppercase tracking-widest animate-pulse">Buscando atividades no servidor...</p>
                </div>
              ) : (
                <TaskListView
                  tasks={filteredAndSortedTasks}
                  baselineTasks={baselineTasks}
                  onEditTask={onOpenModal}
                  onDeleteTask={handleDeleteTask}
                  onSort={handleSort}
                  sortConfig={sortConfig}
                  userRole={user.role}
                  allUsers={allUsers}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Tarefa?"
        message="Essa ação não pode ser desfeita. A tarefa será removida permanentemente."
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Dashboard;