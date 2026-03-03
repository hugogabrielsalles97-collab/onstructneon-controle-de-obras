
import React from 'react';
import { Task, TaskStatus, User } from '../types';
import SortIcon from './icons/SortIcon';
import EditIcon from './icons/EditIcon';
import DeleteIcon from './icons/DeleteIcon';
import EyeIcon from './icons/EyeIcon';
import XIcon from './icons/XIcon';
import WhatsAppIcon from './icons/WhatsAppIcon';

type SortKey = keyof Task | 'none';
type SortDirection = 'asc' | 'desc';
type DisplayStatus = TaskStatus | 'Atrasado';

interface TaskListViewProps {
  tasks: Task[];
  baselineTasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onSort: (key: SortKey) => void;
  sortConfig: { key: SortKey; direction: SortDirection };
  userRole: User['role'];
  allUsers: User[];
}

const statusColorConfig: Record<DisplayStatus, string> = {
  [TaskStatus.ToDo]: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  [TaskStatus.InProgress]: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  [TaskStatus.Completed]: 'bg-green-500/20 text-green-300 border border-green-500/30',
  'Atrasado': 'bg-red-500/20 text-red-300 border border-red-500/30',
};

const progressBarColorConfig: Record<DisplayStatus, string> = {
  [TaskStatus.ToDo]: 'bg-yellow-500',
  [TaskStatus.InProgress]: 'bg-blue-500',
  [TaskStatus.Completed]: 'bg-green-500',
  'Atrasado': 'bg-red-500',
};

const progressTextColorConfig: Record<DisplayStatus, string> = {
  [TaskStatus.ToDo]: 'text-yellow-300',
  [TaskStatus.InProgress]: 'text-blue-300',
  [TaskStatus.Completed]: 'text-green-300',
  'Atrasado': 'text-red-300',
};


const HeaderCell: React.FC<{
  label: string;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  sortConfig: { key: SortKey; direction: SortDirection };
  centered?: boolean;
}> = ({ label, sortKey, onSort, sortConfig, centered }) => {
  const isSorted = sortConfig.key === sortKey;
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-brand-med-gray uppercase tracking-wider cursor-pointer select-none ${centered ? 'text-center' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
        {label}
        <SortIcon
          className={`w-4 h-4 transition-opacity non-printable ${isSorted ? 'opacity-100' : 'opacity-30'}`}
          direction={isSorted ? sortConfig.direction : 'asc'}
        />
      </div>
    </th>
  );
};

const TaskListView: React.FC<TaskListViewProps> = ({ tasks, baselineTasks, onEditTask, onDeleteTask, onSort, sortConfig, userRole, allUsers }) => {
  const [selectedPhotos, setSelectedPhotos] = React.useState<string[] | null>(null);

  // OTIMIZAÇÃO: Indexar tarefas da baseline para consulta rápida O(1)
  const baselineMap = React.useMemo(() => {
    const map = new Map<string, Task>();
    baselineTasks.forEach(bt => map.set(bt.id, bt));
    return map;
  }, [baselineTasks]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  const getDisplayStatus = (task: Task): { status: DisplayStatus, text: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate + 'T00:00:00');
    const isOverdue = dueDate < today && task.status !== TaskStatus.Completed;

    if (isOverdue) {
      return { status: 'Atrasado', text: 'Atrasado' };
    }
    return { status: task.status, text: task.status };
  };

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="min-w-full border-separate border-spacing-y-2 px-4 table-print">
        <thead>
          <tr className="bg-transparent">
            <HeaderCell label="Tarefa / Disciplina" sortKey="title" onSort={onSort} sortConfig={sortConfig} />
            <HeaderCell label="Responsável" sortKey="assignee" onSort={onSort} sortConfig={sortConfig} />
            <HeaderCell label="Localização" sortKey="location" onSort={onSort} sortConfig={sortConfig} />
            <HeaderCell label="Apoio" sortKey="support" onSort={onSort} sortConfig={sortConfig} />
            <HeaderCell label="Quantidades" sortKey="quantity" onSort={onSort} sortConfig={sortConfig} />
            <HeaderCell label="Datas" sortKey="dueDate" onSort={onSort} sortConfig={sortConfig} centered={true} />
            <HeaderCell label="Status" sortKey="status" onSort={onSort} sortConfig={sortConfig} />
            <th className="px-4 py-4 text-left text-[10px] font-black text-brand-med-gray uppercase tracking-widest">Avanço</th>
            <th className="px-4 py-4 text-right text-[10px] font-black text-brand-med-gray uppercase tracking-widest non-printable">Ações</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => {
            const display = getDisplayStatus(task);
            const baselineTask = baselineMap.get(task.id);
            // Aplicar stagger apenas às primeiras 10 linhas para performance
            const staggerClass = index < 10 ? `animate-stagger-${Math.min(index + 1, 4)}` : '';

            return (
              <tr
                key={task.id}
                className={`group bg-[#111827]/40 hover:bg-[#111827]/80 border border-white/5 smooth-transition shadow-sm hover:shadow-xl hover:-translate-y-0.5 animate-slide-up ${staggerClass}`}
              >
                <td className="px-5 py-5 rounded-l-2xl border-l border-t border-b border-white/5 relative overflow-hidden hover-shine">
                  <div className="flex flex-col gap-1.5 relative z-10">
                    <div className="text-sm font-black text-white group-hover:text-brand-accent smooth-transition group-hover:translate-x-1 leading-tight">{task.title}</div>
                    {(task.discipline || task.level) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.discipline && (
                          <span className="text-[9px] font-black text-brand-med-gray uppercase bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            {task.discipline}
                          </span>
                        )}
                        {task.level && (
                          <span className="text-[9px] font-black text-brand-accent/70 uppercase bg-brand-accent/5 px-2 py-0.5 rounded-md border border-brand-accent/10 font-mono">
                            {task.level}
                          </span>
                        )}
                        {task.side && (
                          <span className="text-[9px] font-black text-blue-400/80 uppercase bg-blue-400/5 px-2 py-0.5 rounded-md border border-blue-400/20 font-mono">
                            {task.side}
                          </span>
                        )}
                      </div>
                    )}
                    {task.description && <div className="text-xs text-brand-med-gray italic line-clamp-1 max-w-xs">{task.description}</div>}
                  </div>
                </td>
                <td className="px-4 py-5 border-t border-b border-white/5 align-middle">
                  <span className="text-sm font-bold text-gray-300">{task.assignee}</span>
                </td>
                <td className="px-4 py-5 border-t border-b border-white/5 align-middle">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-gray-300 font-medium">{task.location}</span>
                    {task.corte && <span className="text-[10px] font-black text-brand-accent/50 uppercase tracking-tighter italic">Corte: {task.corte}</span>}
                  </div>
                </td>
                <td className="px-4 py-5 border-t border-b border-white/5 align-middle text-sm text-gray-400 font-medium">{task.support || '-'}</td>
                <td className="px-4 py-5 border-t border-b border-white/5 align-middle">
                  <div className="flex flex-col gap-1.5 min-w-[70px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-brand-med-gray w-4">P:</span>
                      <span className="text-xs font-black text-gray-200">{task.quantity} <span className="text-[9px] font-normal opacity-40 uppercase">{task.unit}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-green-500 w-4">R:</span>
                      <span className="text-xs font-black text-green-400">{task.actualQuantity ?? 0} <span className="text-[9px] font-normal opacity-40 uppercase">{task.unit}</span></span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5 border-t border-b border-white/5 align-middle">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 min-w-[120px] justify-center mx-auto">
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-brand-med-gray uppercase tracking-tighter leading-none mb-0.5">Início Plan.</span>
                      <span className="text-[10px] font-bold text-gray-300 leading-none">{formatDate(task.startDate)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-brand-med-gray uppercase tracking-tighter leading-none mb-0.5">Fim Plan.</span>
                      <span className="text-[10px] font-bold text-gray-300 leading-none">{formatDate(task.dueDate)}</span>
                    </div>
                    {task.actualStartDate && (
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black text-green-500 uppercase tracking-tighter leading-none mb-0.5">Início Real</span>
                        <span className="text-[10px] font-bold text-green-400 leading-none">{formatDate(task.actualStartDate)}</span>
                      </div>
                    )}
                    {task.actualEndDate && (
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black text-green-500 uppercase tracking-tighter leading-none mb-0.5">Fim Real</span>
                        <span className="text-[10px] font-bold text-green-400 leading-none">{formatDate(task.actualEndDate)}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-5 border-t border-b border-white/5 align-middle">
                  <span className={`px-3 py-1 inline-flex text-[9px] font-black uppercase tracking-widest rounded-lg border-b-2 shadow-lg ${statusColorConfig[display.status]} status-badge-print`}>
                    {display.text === 'ToDo' ? 'Pendente' : display.text === 'InProgress' ? 'Em Progresso' : display.text}
                  </span>
                </td>
                <td className="px-4 py-5 border-t border-b border-white/5 align-middle min-w-[120px]">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white/5 rounded-full h-2 shadow-inner overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out border-r border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)] ${progressBarColorConfig[display.status]}`}
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                    <span className={`text-[10px] font-black w-8 text-right font-mono ${progressTextColorConfig[display.status]}`}>{task.progress}%</span>
                  </div>
                </td>
                <td className="px-5 py-5 rounded-r-2xl border-r border-t border-b border-white/5 align-middle text-right non-printable">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEditTask(task)}
                      className="flex items-center gap-2 px-3 py-2 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-white rounded-lg transition-all duration-300 border border-brand-accent/20 font-bold text-[10px] uppercase tracking-wider group"
                      title="Checkout"
                    >
                      <EditIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Checkout</span>
                    </button>
                    {task.assignee && (
                      <button
                        onClick={() => {
                          const selectedUser = allUsers.find(u => u.fullName === task.assignee);
                          if (!selectedUser?.whatsapp) {
                            alert("Responsável não possui WhatsApp cadastrado.");
                            return;
                          }
                          const phone = selectedUser.whatsapp.replace(/\D/g, '');
                          const message = `Olá *${selectedUser.fullName}*,%0A%0AFollow-up da atividade:%0A📌 *${task.title}*%0A📍 Local: ${task.location}%0A📅 Prazo: ${new Date(task.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}%0A%0A*Favor atualizar o status no sistema!* 🚀`;
                          window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                        }}
                        className="p-2 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white rounded-lg transition-all duration-300 border border-green-500/20"
                        title="Reenviar WhatsApp"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </button>
                    )}
                    {task.photos && task.photos.length > 0 && (
                      <button
                        onClick={() => setSelectedPhotos(task.photos || null)}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg transition-all duration-300 border border-blue-500/20"
                        title="Ver Fotos"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                    )}
                    {(userRole === 'Master' || userRole === 'Planejador') && (
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-2 bg-white/5 hover:bg-red-500/20 text-brand-med-gray hover:text-red-500 rounded-lg transition-all duration-300 border border-white/5"
                        title="Excluir"
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="text-center py-10 text-brand-med-gray">
          Nenhuma tarefa encontrada. Tente ajustar seus filtros.
        </div>
      )}

      {/* Photo Gallery Modal */}
      {selectedPhotos && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedPhotos(null)}>
          <div className="relative max-w-5xl w-full p-4 flex flex-col items-center gap-8" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 right-0 flex items-center gap-4">
              <p className="text-white/40 font-black uppercase tracking-[3px] text-[10px]">Galeria de Evidências • {selectedPhotos.length} itens</p>
              <button onClick={() => setSelectedPhotos(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all border border-white/10">
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 overflow-y-auto max-h-[80vh] w-full custom-scrollbar p-4">
              {selectedPhotos.map((photo, i) => (
                <div key={i} className="group relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black/20">
                  <img src={photo} className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                    <span className="text-white font-black text-[10px] uppercase tracking-widest bg-brand-accent/80 px-3 py-1.5 rounded-lg shadow-lg">Evidência #{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskListView;