import React, { useMemo, Fragment } from 'react';
import { Task, TaskStatus } from '../types';

interface TimelineViewProps {
    tasks: Task[];
    baselineTasks: Task[];
    onEditTask: (task: Task) => void;
}

type DisplayStatus = TaskStatus | 'Atrasado';

const statusColors: Record<DisplayStatus, string> = {
    [TaskStatus.ToDo]: 'bg-yellow-400',
    [TaskStatus.InProgress]: 'bg-blue-400',
    [TaskStatus.Completed]: 'bg-green-500',
    'Atrasado': 'bg-red-500',
};

const getDaysDifference = (start: Date, end: Date) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
};

const getDisplayStatus = (task: Task): DisplayStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate + 'T00:00:00');
    const isOverdue = dueDate < today && task.status !== TaskStatus.Completed;

    if (isOverdue) {
        return 'Atrasado';
    }
    return task.status;
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const TimelineView: React.FC<TimelineViewProps> = ({ tasks, baselineTasks, onEditTask }) => {
    const { dateRange, projectStart, projectEnd, today } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Ajuste: Definir o range baseado APENAS nas tarefas criadas (tasks), ignorando a baseline para o zoom inicial
        // Se não houver tasks, usa a baseline como fallback
        const tasksForRange = tasks.length > 0 ? tasks : baselineTasks;

        if (tasksForRange.length === 0) {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return { dateRange: [], projectStart: monthStart, projectEnd: monthEnd, today };
        }

        const allDates: number[] = [];
        tasksForRange.forEach(t => {
            allDates.push(new Date(t.startDate).getTime());
            allDates.push(new Date(t.dueDate).getTime());
            if (t.actualStartDate) allDates.push(new Date(t.actualStartDate).getTime());
            if (t.actualEndDate) allDates.push(new Date(t.actualEndDate).getTime());
        });

        const projectStart = new Date(allDates.length > 0 ? Math.min(...allDates) : new Date().getTime());
        const projectEnd = new Date(allDates.length > 0 ? Math.max(...allDates) : new Date().getTime());

        projectStart.setDate(projectStart.getDate() - 2); // Add some padding
        projectEnd.setDate(projectEnd.getDate() + 2); // Add some padding

        const range = [];
        let currentDate = new Date(projectStart);
        while (currentDate <= projectEnd) {
            range.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return { dateRange: range, projectStart, projectEnd, today };
    }, [tasks, baselineTasks]);

    const totalDays = getDaysDifference(projectStart, projectEnd) + 1;
    const todayOffset = getDaysDifference(projectStart, today);
    const isTodayVisible = todayOffset >= 0 && todayOffset < totalDays;

    const sortedVisibleTasks = useMemo(() => {
        return [...tasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [tasks]);

    return (
        <div className="bg-transparent p-4 overflow-x-auto relative custom-scrollbar">
            <div style={{ minWidth: `${totalDays * 40}px` }}>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(40px, 1fr))` }}>
                    {dateRange.map((date, i) => (
                        <div key={i} className={`text-center border-r border-brand-darkest/50 py-2 ${date.getDay() === 0 || date.getDay() === 6 ? 'bg-brand-darkest/30' : ''}`}>
                            <p className="text-xs text-brand-med-gray">{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                            <p className="text-sm font-bold text-gray-200">{date.getDate()}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-2 relative">
                    {isTodayVisible && (
                        <div
                            className="absolute top-0 h-full border-r-2 border-dashed border-brand-accent/70 z-10 pointer-events-none"
                            style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                        >
                            <div className="absolute -top-7 -translate-x-1/2 bg-brand-accent text-white text-xs font-bold px-2 py-0.5 rounded shadow-lg">
                                HOJE
                            </div>
                        </div>
                    )}
                    {sortedVisibleTasks.map((task, index) => {
                        // Use actual dates for rendering if available
                        const effectiveStartDateStr = task.actualStartDate || task.startDate;
                        // If actualEndDate is missing but actualStartDate exists, use actualStartDate + duration or just actualStartDate
                        // For now, if actualEndDate is missing, we might use dueDate, but that might be misleading if the task is late.
                        // Let's rely on standard logic: if actualEndDate exists, use it. If not, use dueDate.
                        const effectiveEndDateStr = task.actualEndDate || task.dueDate;

                        const taskStart = new Date(effectiveStartDateStr);
                        const taskEnd = new Date(effectiveEndDateStr);

                        const startOffset = getDaysDifference(projectStart, taskStart);
                        const duration = getDaysDifference(taskStart, taskEnd) + 1;
                        const displayStatus = getDisplayStatus(task);
                        const baselineTask = baselineTasks.find(bt => bt.id === task.id);

                        // Visual Limit Logic: Clamp progress bar to "Today"
                        let visualProgress = task.progress;
                        // Only clamp if the task overlaps with today or is in the future relative to today
                        if (taskStart <= today) {
                            if (taskEnd >= today) {
                                // Calculate days passed until start of today (exclusive of today)
                                const daysToToday = getDaysDifference(taskStart, today);
                                const maxPossibleProgress = (daysToToday / duration) * 100;
                                visualProgress = Math.max(0, Math.min(task.progress, maxPossibleProgress));
                            }
                            // If taskEnd < today, allow full progress (100% or whatever it is)
                        } else {
                            // Task starts in future
                            visualProgress = 0;
                        }

                        if (startOffset < 0 || duration <= 0) return null;

                        return (
                            <div key={task.id} style={{ position: 'relative', height: '48px' }}>
                                {baselineTask && (() => {
                                    const baselineStart = new Date(baselineTask.startDate);
                                    const baselineEnd = new Date(baselineTask.dueDate);
                                    const baselineStartOffset = getDaysDifference(projectStart, baselineStart);
                                    const baselineDuration = getDaysDifference(baselineStart, baselineEnd) + 1;

                                    if (baselineStartOffset < 0 || baselineDuration <= 0) return null;

                                    return (
                                        <div
                                            className="absolute h-3 bg-cyan-400/40 rounded group"
                                            style={{
                                                top: '28px',
                                                left: `${(baselineStartOffset / totalDays) * 100}%`,
                                                width: `${(baselineDuration / totalDays) * 100}%`,
                                                zIndex: 15,
                                            }}
                                        >
                                            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 w-max max-w-xs bg-brand-darkest text-white text-xs rounded py-1 px-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                                                <p className="font-bold text-cyan-400">Linha Base: {baselineTask.title}</p>
                                                <p>{formatDate(baselineTask.startDate)} - {formatDate(baselineTask.dueDate)}</p>
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-brand-darkest"></div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div
                                    className="h-10 flex items-center group cursor-pointer absolute"
                                    style={{
                                        top: 0,
                                        left: `${(startOffset / totalDays) * 100}%`,
                                        width: `${(duration / totalDays) * 100}%`,
                                        zIndex: 20,
                                    }}
                                    onClick={() => onEditTask(task)}
                                >
                                    <div className={`relative w-full h-full rounded-md bg-brand-dark/50 border ${task.actualStartDate ? 'border-brand-accent' : 'border-brand-med-gray/40'} flex items-center transition-all group-hover:brightness-125 shadow-md`}>
                                        {task.progress > 0 && (
                                            <div
                                                className={`absolute top-0 left-0 h-full ${statusColors[displayStatus]} rounded-md`}
                                                style={{ width: `${visualProgress}%` }}
                                            ></div>
                                        )}
                                        <p className="relative z-10 text-sm font-semibold text-white truncate text-shadow px-3">
                                            {task.title}
                                        </p>
                                    </div>
                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-max max-w-xs bg-brand-darkest text-white text-xs rounded py-1 px-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                                        <p className="font-bold">{task.title}</p>
                                        <p>{task.assignee}</p>
                                        <p>Progresso: {task.progress}%</p>
                                        <div className="mt-1 pt-1 border-t border-white/20">
                                            <p className="text-[10px] opacity-75">Prev: {formatDate(task.startDate)} - {formatDate(task.dueDate)}</p>
                                            {task.actualStartDate && (
                                                <p className="text-[10px] text-brand-accent font-bold">Real: {formatDate(task.actualStartDate)} {task.actualEndDate ? `- ${formatDate(task.actualEndDate)}` : ''}</p>
                                            )}
                                        </div>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-brand-darkest"></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ height: `${tasks.length * 48}px` }} />
            </div>
        </div>
    );
};

export default TimelineView;