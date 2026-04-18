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

    if (isOverdue) return 'Atrasado';
    return task.status;
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const TimelineView: React.FC<TimelineViewProps> = ({ tasks, baselineTasks, onEditTask }) => {
    const { dateRange, projectStart, projectEnd, today } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
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
        });

        const projectStart = new Date(Math.min(...allDates));
        const projectEnd = new Date(Math.max(...allDates));
        projectStart.setDate(projectStart.getDate() - 2);
        projectEnd.setDate(projectEnd.getDate() + 2);

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

    // Grouping Logic
    const groupedData = useMemo(() => {
        const hierarchy: Record<string, Record<string, Task[]>> = {};
        tasks.forEach(task => {
            const loc = task.location || 'Sem Localização';
            const sup = task.support || 'Geral';
            if (!hierarchy[loc]) hierarchy[loc] = {};
            if (!hierarchy[loc][sup]) hierarchy[loc][sup] = [];
            hierarchy[loc][sup].push(task);
        });

        return Object.keys(hierarchy).sort().map(loc => ({
            location: loc,
            supports: Object.keys(hierarchy[loc]).sort().map(sup => ({
                support: sup,
                tasks: hierarchy[loc][sup].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            }))
        }));
    }, [tasks]);

    return (
        <div className="flex flex-col border border-white/5 rounded-xl bg-[#0d1425] relative overflow-hidden h-[700px]">
            {/* O Gantt agora tem sua própria rolagem vertical e horizontal controlada internamente */}
            <div className="flex overflow-auto custom-scrollbar relative flex-1 h-full">

                {/* Sidebar labels column - Fixa na Esquerda */}
                <div className="w-64 flex-shrink-0 bg-[#0d1425] border-r border-white/10 relative z-50 sticky left-0 shadow-2xl">
                    <div className="h-14 border-b border-white/10 flex items-center px-4 sticky top-0 bg-[#0d1425] z-[60] shadow-sm">
                        <span className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest">Local / Apoio / Atividade</span>
                    </div>
                    {groupedData.map((locGroup, i) => (
                        <div key={locGroup.location}>
                            {/* Location Header - Fixo no Topo ao rolar a lista daquela OAE */}
                            <div className="h-10 bg-brand-accent/15 flex items-center px-4 border-b border-white/5 sticky top-14 bg-[#0d1425] z-[55] shadow-sm">
                                <span className="text-xs font-black text-brand-accent truncate tracking-wide">📍 {locGroup.location}</span>
                            </div>
                            {locGroup.supports.map(supGroup => (
                                <div key={supGroup.support}>
                                    {/* Support Header - Fixo no Topo abaixo da OAE */}
                                    <div className="h-8 bg-white/5 flex items-center px-6 border-b border-white/5 sticky top-[96px] bg-[#1a2235] z-[50] shadow-sm">
                                        <span className="text-[10px] font-extrabold text-blue-300/70 truncate">↳ Apoio: {supGroup.support}</span>
                                    </div>
                                    {supGroup.tasks.map(task => (
                                        <div key={task.id} className="h-12 flex items-center px-8 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => onEditTask(task)}>
                                            <span className="text-[10px] font-medium text-gray-300 truncate group-hover:text-white transition-colors">• {task.title}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Timeline Area - Rolagem Horizontal de datas e barras */}
                <div className="flex-1 relative bg-brand-darkest/20" style={{ minWidth: `${totalDays * 50}px` }}>
                    {/* Sticky Date Header - Fixado no topo do scroll interno com z-index máximo */}
                    <div className="h-14 grid border-b border-white/10 bg-[#0d1425] sticky top-0 z-[60] shadow-md" style={{ gridTemplateColumns: `repeat(${totalDays}, 50px)` }}>
                        {dateRange.map((date, i) => (
                            <div key={i} className={`text-center border-r border-white/5 py-2 flex flex-col justify-center ${date.getDay() === 0 || date.getDay() === 6 ? 'bg-white/5 shadow-inner' : ''}`}>
                                <p className="text-[9px] font-black text-brand-med-gray uppercase leading-none mb-1">{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                                <p className="text-xs font-black text-white leading-none">{date.getDate()}</p>
                            </div>
                        ))}
                    </div>

                    {/* Hierarchy-aligned rows */}
                    <div className="relative">
                        {/* Today Line */}
                        {todayOffset >= 0 && todayOffset < totalDays && (
                            <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-brand-accent/50 z-10 pointer-events-none" style={{ left: `${todayOffset * 50 + 25}px` }}>
                                <div className="sticky top-16 -translate-x-1/2 bg-brand-accent text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-neon z-10">HOJE</div>
                            </div>
                        )}

                        {groupedData.map(locGroup => (
                            <div key={`timeline-${locGroup.location}`}>
                                {/* Row for Location Header spacer - Sticky background */}
                                <div className="h-10 border-b border-white/5 bg-brand-accent/10 sticky top-14 z-20"></div>
                                {locGroup.supports.map(supGroup => (
                                    <div key={`timeline-${supGroup.support}`}>
                                        {/* Row for Support Header spacer - Sticky background */}
                                        <div className="h-8 border-b border-white/5 bg-white/5 sticky top-[96px] z-10"></div>
                                        {supGroup.tasks.map(task => {
                                            const taskStart = new Date(task.actualStartDate || task.startDate);
                                            const taskEnd = new Date(task.actualEndDate || task.dueDate);
                                            const startOffset = getDaysDifference(projectStart, taskStart);
                                            const duration = getDaysDifference(taskStart, taskEnd) + 1;
                                            const displayStatus = getDisplayStatus(task);
                                            const baselineTask = baselineTasks.find(bt => bt.id === task.id);

                                            return (
                                                <div key={`task-row-${task.id}`} className="h-12 border-b border-white/5 relative group hover:bg-white/[0.02]">
                                                    {/* Baseline bar (shadow) */}
                                                    {baselineTask && (() => {
                                                        const bStart = new Date(baselineTask.startDate);
                                                        const bEnd = new Date(baselineTask.dueDate);
                                                        const bOffset = getDaysDifference(projectStart, bStart);
                                                        const bDur = getDaysDifference(bStart, bEnd) + 1;
                                                        return (
                                                            <div className="absolute h-1 bg-cyan-400/20 rounded-full bottom-2"
                                                                style={{ left: `${bOffset * 50 + 5}px`, width: `${bDur * 50 - 10}px` }} />
                                                        );
                                                    })()}

                                                    {/* Task Bar */}
                                                    <div className={`absolute top-2.5 h-6 rounded-md border flex items-center shadow-lg transition-all group-hover:brightness-125 cursor-pointer overflow-hidden ${task.actualStartDate ? 'border-brand-accent/40 shadow-brand-accent/10' : 'border-white/10'}`}
                                                        style={{ left: `${startOffset * 50 + 4}px`, width: `${duration * 50 - 8}px`, backgroundColor: 'rgba(255,255,255,0.03)' }}
                                                        onClick={() => onEditTask(task)}>
                                                        {task.progress > 0 && (
                                                            <div className={`absolute left-0 top-0 bottom-0 ${statusColors[displayStatus]} opacity-70`}
                                                                style={{ width: `${task.progress}%` }} />
                                                        )}
                                                    </div>

                                                    {/* Tooltip on Hover */}
                                                    <div className="absolute top-0 bottom-0 left-0 right-0 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                        <div className="absolute top-[-50px] left-[50%] -translate-x-1/2 bg-[#060a12] border border-white/10 text-white text-[10px] px-3 py-2 rounded-lg shadow-2xl min-w-[180px] z-[70]">
                                                            <p className="font-black text-brand-accent mb-1 border-b border-white/5 pb-1">{task.title}</p>
                                                            <p className="opacity-70">🗓️ {formatDate(task.startDate)} a {formatDate(task.dueDate)}</p>
                                                            <p className="font-bold flex justify-between">Progresso: <span className="text-brand-accent">{task.progress}%</span></p>
                                                            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#060a12] border-r border-b border-white/10 rotate-45"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimelineView;