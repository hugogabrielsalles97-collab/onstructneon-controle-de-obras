import React, { useMemo } from 'react';
import { Task, TaskStatus } from '../types';

type StatusFilter = 'all' | 'overdue' | TaskStatus;

interface DashboardSummaryProps {
  tasks: Task[];
  onStatusSelect: (status: StatusFilter) => void;
  activeStatus: StatusFilter;
}

interface SummaryCardProps {
  title: string;
  value: number | string;
  color: 'green' | 'red' | 'yellow' | 'blue' | 'med-gray';
  onClick: () => void;
  isActive: boolean;
  index: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, color, onClick, isActive, index }) => {
  const accents = {
    green: 'bg-green-500 shadow-green-500/20',
    red: 'bg-red-500 shadow-red-500/20',
    yellow: 'bg-yellow-400 shadow-yellow-400/20',
    blue: 'bg-blue-400 shadow-blue-400/20',
    'med-gray': 'bg-brand-med-gray shadow-gray-500/20',
  }

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-[#111827]/80 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-2xl flex flex-col justify-between min-h-[120px] cursor-pointer smooth-transition group hover:scale-[1.03] hover:bg-brand-dark/90 hover:shadow-brand-accent/10 hover-shine animate-slide-up animate-stagger-${index} ${isActive ? 'ring-2 ring-brand-accent border-brand-accent/50 bg-brand-dark shadow-[0_0_20px_rgba(227,90,16,0.15)]' : ''
        }`}
    >
      {/* Accent light decoration */}
      <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity ${accents[color]}`}></div>

      <div className="relative z-10 flex flex-col gap-1">
        <h4 className="text-[10px] font-black text-brand-med-gray uppercase tracking-[1.5px] group-hover:text-gray-300 transition-colors">
          {title}
        </h4>
        <p className="text-4xl font-black text-white tracking-tighter group-hover:scale-110 transition-transform origin-left">
          {value}
        </p>
      </div>

      {/* Status bar at bottom */}
      <div className={`mt-4 h-1 rounded-full w-full bg-white/5`}>
        <div className={`h-full rounded-full ${accents[color]} transition-all duration-700 ease-out`} style={{ width: isActive ? '100%' : '40%' }}></div>
      </div>
    </div>
  );
};

const DashboardSummary: React.FC<DashboardSummaryProps> = ({ tasks, onStatusSelect, activeStatus }) => {
  const { completedTasks, overdueTasks, inProgressOnTime, toDoOnTime } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completed = tasks.filter(t => t.status === TaskStatus.Completed);
    const notCompleted = tasks.filter(t => t.status !== TaskStatus.Completed);

    const overdue = notCompleted.filter(t => new Date(t.dueDate + 'T00:00:00') < today);
    const onTime = notCompleted.filter(t => new Date(t.dueDate + 'T00:00:00') >= today);

    const inProgress = onTime.filter(t => t.status === TaskStatus.InProgress);
    const toDo = onTime.filter(t => t.status === TaskStatus.ToDo);

    return {
      completedTasks: completed.length,
      overdueTasks: overdue.length,
      inProgressOnTime: inProgress.length,
      toDoOnTime: toDo.length,
    };
  }, [tasks]);

  return (
    <>
      <SummaryCard index={1} title="Total de Tarefas" value={tasks.length} color="med-gray" onClick={() => onStatusSelect('all')} isActive={activeStatus === 'all'} />
      <SummaryCard index={2} title="Tarefas Concluídas" value={completedTasks} color="green" onClick={() => onStatusSelect(TaskStatus.Completed)} isActive={activeStatus === TaskStatus.Completed} />
      <SummaryCard index={3} title="Tarefas Atrasadas" value={overdueTasks} color="red" onClick={() => onStatusSelect('overdue')} isActive={activeStatus === 'overdue'} />
      <SummaryCard index={4} title="Em Andamento" value={inProgressOnTime} color="blue" onClick={() => onStatusSelect(TaskStatus.InProgress)} isActive={activeStatus === TaskStatus.InProgress} />
      <SummaryCard index={5} title="A Iniciar" value={toDoOnTime} color="yellow" onClick={() => onStatusSelect(TaskStatus.ToDo)} isActive={activeStatus === TaskStatus.ToDo} />
    </>
  );
};

export default DashboardSummary;