
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, TaskStatus } from '../types';
import { useData } from '../context/DataProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend, AreaChart, Area } from 'recharts';
import ConstructionIcon from './icons/ConstructionIcon';

interface WarRoomTVPageProps {
    onNavigateToHome?: () => void;
    showToast?: (message: string, type: 'success' | 'error') => void;
}

// ==============================
// SLIDE 1 — RESUMO GERAL DE TAREFAS
// ==============================
const SlideTaskSummary: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const stats = useMemo(() => {
        const todayNum = new Date().setHours(0, 0, 0, 0);
        let completed = 0, overdue = 0, inProgress = 0, toDo = 0;
        let totalProgress = 0;

        tasks.forEach(task => {
            totalProgress += task.progress || 0;
            if (task.status === TaskStatus.Completed) {
                completed++;
            } else {
                const dueDateNum = new Date(task.dueDate + 'T00:00:00').getTime();
                if (dueDateNum < todayNum) {
                    overdue++;
                } else {
                    if (task.status === TaskStatus.InProgress) inProgress++;
                    else if (task.status === TaskStatus.ToDo) toDo++;
                }
            }
        });

        const avgProgress = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;
        const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

        return { total: tasks.length, completed, overdue, inProgress, toDo, avgProgress, completionRate };
    }, [tasks]);

    const cards = [
        { label: 'Total de Tarefas', value: stats.total, color: '#6b7280', icon: '📋', bgGlow: 'rgba(107,114,128,0.15)' },
        { label: 'Concluídas', value: stats.completed, color: '#22c55e', icon: '✅', bgGlow: 'rgba(34,197,94,0.15)' },
        { label: 'Atrasadas', value: stats.overdue, color: '#ef4444', icon: '🚨', bgGlow: 'rgba(239,68,68,0.15)' },
        { label: 'Em Andamento', value: stats.inProgress, color: '#3b82f6', icon: '🔄', bgGlow: 'rgba(59,130,246,0.15)' },
        { label: 'A Iniciar', value: stats.toDo, color: '#eab308', icon: '⏳', bgGlow: 'rgba(234,179,8,0.15)' },
    ];

    return (
        <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-12 animate-fade-in">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Resumo Geral</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">Visão de tarefas programadas</p>
            </div>

            <div className="grid grid-cols-5 gap-6 w-full max-w-7xl mb-12">
                {cards.map((card, i) => (
                    <div key={card.label} className="relative overflow-hidden bg-[#111827]/80 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center text-center group hover:scale-105 transition-all duration-500" style={{ animationDelay: `${i * 100}ms`, boxShadow: `0 0 60px ${card.bgGlow}` }}>
                        <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-30" style={{ backgroundColor: card.color }}></div>
                        <span className="text-4xl mb-3">{card.icon}</span>
                        <p className="text-6xl font-black tracking-tighter mb-2" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-[11px] font-black text-brand-med-gray uppercase tracking-[2px]">{card.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-8 w-full max-w-3xl">
                <div className="bg-[#111827]/60 backdrop-blur-xl rounded-3xl border border-white/5 p-8 text-center" style={{ boxShadow: '0 0 40px rgba(227,90,16,0.1)' }}>
                    <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-[3px] mb-3">Avanço Médio</p>
                    <p className="text-7xl font-black text-brand-accent tracking-tighter">{stats.avgProgress}%</p>
                    <div className="mt-4 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-orange-400 transition-all duration-1000" style={{ width: `${stats.avgProgress}%` }}></div>
                    </div>
                </div>
                <div className="bg-[#111827]/60 backdrop-blur-xl rounded-3xl border border-white/5 p-8 text-center" style={{ boxShadow: '0 0 40px rgba(34,197,94,0.1)' }}>
                    <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-[3px] mb-3">Taxa de Conclusão</p>
                    <p className="text-7xl font-black text-green-500 tracking-tighter">{stats.completionRate}%</p>
                    <div className="mt-4 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000" style={{ width: `${stats.completionRate}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==============================
// SLIDE 2 — PPC (Percentual de Planos Concluídos)
// ==============================
const SlidePPC: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const chartData = useMemo(() => {
        if (tasks.length === 0) return [];

        // Determinar o fim da última semana fechada (sábado passado)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        const lastClosedWeekEnd = new Date(currentWeekStart);
        lastClosedWeekEnd.setDate(lastClosedWeekEnd.getDate() - 1);
        lastClosedWeekEnd.setHours(23, 59, 59, 999);

        const start = new Date(Math.min(...tasks.map(t => new Date(t.startDate).getTime())));
        const end = new Date(Math.max(...tasks.map(t => new Date(t.dueDate).getTime())));

        const weeks: { [key: string]: { planned: number; completed: number } } = {};

        tasks.forEach(task => {
            const taskDueDate = new Date(task.dueDate + 'T23:59:59');

            // Ignorar tarefas (e semanas) que ainda não foram fechadas (da semana atual em diante)
            if (taskDueDate > lastClosedWeekEnd) return;

            if (taskDueDate >= start && taskDueDate <= end) {
                const d = new Date(taskDueDate);
                d.setDate(d.getDate() - d.getDay());
                const weekKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                if (!weeks[weekKey]) weeks[weekKey] = { planned: 0, completed: 0 };
                weeks[weekKey].planned += 1;
                if (task.status === 'Concluído' && task.actualEndDate) {
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
            name: `Sem. ${week}`,
            ppc: weeks[week].planned > 0 ? Math.round((weeks[week].completed / weeks[week].planned) * 100) : 0,
            planned: weeks[week].planned,
            completed: weeks[week].completed
        }));
    }, [tasks]);

    const averagePpc = useMemo(() => {
        if (chartData.length === 0) return 0;
        return Math.round(chartData.reduce((acc, d) => acc + d.ppc, 0) / chartData.length);
    }, [chartData]);

    return (
        <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-8">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Curva PPC</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">Percentual de Planos Concluídos por Semana</p>
            </div>

            <div className="flex items-center gap-8 mb-8">
                <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/5 px-10 py-6 text-center" style={{ boxShadow: '0 0 50px rgba(227,90,16,0.15)' }}>
                    <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-[3px] mb-1">PPC Médio</p>
                    <p className="text-6xl font-black text-brand-accent tracking-tighter">{averagePpc}%</p>
                </div>
                <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/5 px-10 py-6 text-center">
                    <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-[3px] mb-1">Semanas</p>
                    <p className="text-6xl font-black text-cyan-400 tracking-tighter">{chartData.length}</p>
                </div>
            </div>

            <div className="w-full max-w-6xl h-[400px]">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="name" stroke="#9d9d9c" tick={{ fontSize: 12, fontWeight: '700' }} axisLine={false} tickLine={false} />
                            <YAxis stroke="#9d9d9c" tick={{ fontSize: 12, fontWeight: '700' }} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#0a0f18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '12px', fontWeight: '700' }}
                                itemStyle={{ color: '#f3f4f6' }}
                            />
                            <ReferenceLine y={averagePpc} stroke="#e35a10" strokeDasharray="5 5" strokeWidth={2}
                                label={{ position: 'right', value: `Média: ${averagePpc}%`, fill: '#e35a10', fontSize: 12, fontWeight: '800' }}
                            />
                            <Bar dataKey="ppc" name="PPC %" radius={[8, 8, 0, 0]} barSize={50}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.ppc >= 80 ? '#22c55e' : entry.ppc >= 50 ? '#eab308' : '#ef4444'} fillOpacity={0.85} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-brand-med-gray text-xl italic">Dados insuficientes para PPC</div>
                )}
            </div>
        </div>
    );
};

// ==============================
// SLIDE 3 — DESEMPENHO POR RESPONSÁVEL
// ==============================
const SlidePerformance: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const data = useMemo(() => {
        const assigneeMap: { [key: string]: { total: number; completed: number; overdue: number } } = {};
        const todayNum = new Date().setHours(0, 0, 0, 0);

        tasks.forEach(task => {
            const assignee = task.assignee || 'Sem Responsável';
            if (!assigneeMap[assignee]) assigneeMap[assignee] = { total: 0, completed: 0, overdue: 0 };
            assigneeMap[assignee].total++;
            if (task.status === TaskStatus.Completed) assigneeMap[assignee].completed++;
            else if (new Date(task.dueDate + 'T00:00:00').getTime() < todayNum) assigneeMap[assignee].overdue++;
        });

        return Object.entries(assigneeMap)
            .map(([name, stats]) => ({
                name: name.length > 18 ? name.substring(0, 18) + '…' : name,
                fullName: name,
                concluídas: stats.completed,
                atrasadas: stats.overdue,
                emAberto: stats.total - stats.completed - stats.overdue,
                total: stats.total,
                rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [tasks]);

    return (
        <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-8">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Performance</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">Top 10 Responsáveis por Volume de Tarefas</p>
            </div>

            <div className="w-full max-w-6xl h-[500px]">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 50, left: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                            <XAxis type="number" stroke="#9d9d9c" tick={{ fontSize: 11, fontWeight: '700' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" width={160} stroke="#9d9d9c" tick={{ fontSize: 11, fontWeight: '600' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0a0f18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '12px', fontWeight: '700' }}
                                itemStyle={{ color: '#f3f4f6' }}
                            />
                            <Bar dataKey="concluídas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="emAberto" name="em aberto" stackId="a" fill="#3b82f6" />
                            <Bar dataKey="atrasadas" stackId="a" fill="#ef4444" radius={[0, 8, 8, 0]} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', paddingTop: '16px' }} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-brand-med-gray text-xl italic">Nenhum dado disponível</div>
                )}
            </div>
        </div>
    );
};

// ==============================
// SLIDE 4 — STATUS POR NÍVEL
// ==============================
const SlideLevel: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const data = useMemo(() => {
        const todayNum = new Date().setHours(0, 0, 0, 0);
        const map: { [key: string]: { completed: number; overdue: number; inProgress: number; toDo: number; total: number } } = {};

        tasks.forEach(task => {
            const level = task.level || 'Sem Nível';
            if (!map[level]) map[level] = { completed: 0, overdue: 0, inProgress: 0, toDo: 0, total: 0 };
            map[level].total++;

            if (task.status === TaskStatus.Completed) {
                map[level].completed++;
            } else {
                const dueDateNum = new Date(task.dueDate + 'T00:00:00').getTime();
                if (dueDateNum < todayNum) {
                    map[level].overdue++;
                } else if (task.status === TaskStatus.InProgress) {
                    map[level].inProgress++;
                } else {
                    map[level].toDo++;
                }
            }
        });

        return Object.entries(map)
            .map(([level, stats]) => ({
                level: level.length > 25 ? level.substring(0, 25) + '…' : level,
                ...stats,
                rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [tasks]);

    return (
        <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-8">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Por Nível</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">Análise de progresso por nível de disciplina</p>
            </div>

            <div className="w-full max-w-6xl">
                <div className="grid grid-cols-1 gap-3">
                    {/* Table Header */}
                    <div className="grid grid-cols-7 gap-3 px-6 py-3">
                        <div className="col-span-2 text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Nível</div>
                        <div className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] text-center">Total</div>
                        <div className="text-[10px] font-black text-green-500 uppercase tracking-[2px] text-center">Concluídas</div>
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-[2px] text-center">Andamento</div>
                        <div className="text-[10px] font-black text-red-500 uppercase tracking-[2px] text-center">Atrasadas</div>
                        <div className="text-[10px] font-black text-brand-accent uppercase tracking-[2px] text-center">% Conclusão</div>
                    </div>

                    {data.map((item, i) => (
                        <div key={item.level} className="grid grid-cols-7 gap-3 bg-[#111827]/60 backdrop-blur-xl rounded-2xl border border-white/5 px-6 py-5 items-center hover:border-brand-accent/20 transition-all" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className="col-span-2 text-white font-bold text-sm">{item.level}</div>
                            <div className="text-center text-2xl font-black text-white">{item.total}</div>
                            <div className="text-center text-2xl font-black text-green-500">{item.completed}</div>
                            <div className="text-center text-2xl font-black text-blue-400">{item.inProgress}</div>
                            <div className="text-center text-2xl font-black text-red-500">{item.overdue}</div>
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2">
                                    <span className="text-2xl font-black text-brand-accent">{item.rate}%</span>
                                </div>
                                <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-1000" style={{
                                        width: `${item.rate}%`,
                                        backgroundColor: item.rate >= 80 ? '#22c55e' : item.rate >= 50 ? '#eab308' : '#ef4444'
                                    }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ==============================
// SLIDE 5 — PPC ACUMULADO
// ==============================
const SlidePPCAccumulated: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const chartData = useMemo(() => {
        if (tasks.length === 0) return [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Encontrar o início da semana atual (domingo)
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        // A última semana "fechada" é a que terminou antes do início da semana atual
        const lastClosedWeekEnd = new Date(currentWeekStart);
        lastClosedWeekEnd.setDate(lastClosedWeekEnd.getDate() - 1); // Sábado passado

        const tasksByWeek: { weekStart: Date; weekEnd: Date; key: string; total: number; completed: number }[] = [];
        const allDates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.dueDate)]);
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

        // Criar intervalos semanais
        const current = new Date(minDate);
        current.setDate(current.getDate() - current.getDay()); // Início da semana (domingo)

        while (current <= maxDate) {
            const weekEnd = new Date(current);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const key = current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            let total = 0, completed = 0;
            tasks.forEach(task => {
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

        return tasksByWeek.map(week => {
            // O "realizado" só mostra dados até a última semana fechada
            const isAfterLastClosed = week.weekStart > lastClosedWeekEnd;
            return {
                name: `Sem. ${week.key}`,
                planejado: Math.round((week.total / tasks.length) * 100),
                realizado: isAfterLastClosed ? null : Math.round((week.completed / tasks.length) * 100),
            };
        });
    }, [tasks]);

    return (
        <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-8">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">PPC Acumulado</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">Planejado vs Realizado — Acumulado até a última semana fechada</p>
            </div>

            <div className="w-full max-w-6xl h-[480px]">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 20, right: 40, left: 0, bottom: 10 }}>
                            <defs>
                                <linearGradient id="colorPlanejado" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" stroke="#9d9d9c" tick={{ fontSize: 11, fontWeight: '700' }} axisLine={false} tickLine={false} />
                            <YAxis stroke="#9d9d9c" tick={{ fontSize: 11, fontWeight: '700' }} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip contentStyle={{ backgroundColor: '#0a0f18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '12px', fontWeight: '700' }} itemStyle={{ color: '#f3f4f6' }} />
                            <Area type="monotone" dataKey="planejado" stroke="#3b82f6" strokeWidth={3} fill="url(#colorPlanejado)" name="Planejado %" connectNulls={false} />
                            <Area type="monotone" dataKey="realizado" stroke="#22c55e" strokeWidth={3} fill="url(#colorRealizado)" name="Realizado %" connectNulls={false} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', paddingTop: '16px' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-brand-med-gray text-xl italic">Dados insuficientes</div>
                )}
            </div>
        </div>
    );
};

// ==============================
// SLIDE 6 — CONTROLE VISUAL (atividades do dia por OAE)
// ==============================

// Dados fixos das OAEs (leve, sem query)
const WAR_ROOM_OAE_LIST = [
    { id: 'OAE S01', label: 'S01', engineer: 'Bruno Bastos' },
    { id: 'OAE S02', label: 'S02', engineer: 'Bruno Bastos' },
    { id: 'OAE S03', label: 'S03', engineer: 'Bruno Bastos' },
    { id: 'OAE S04', label: 'S04', engineer: 'Bruno Bastos' },
    { id: 'OAE S05', label: 'S05', engineer: 'Bruno Bastos' },
    { id: 'OAE S06', label: 'S06', engineer: 'Bruno Bastos' },
    { id: 'OAE S07', label: 'S07', engineer: 'Bruno Bastos' },
    { id: 'OAE S08', label: 'S08', engineer: 'Bruno Bastos' },
    { id: 'OAE S09', label: 'S09', engineer: 'Bruno Bastos' },
    { id: 'OAE S10', label: 'S10', engineer: 'Matheus Ramos' },
    { id: 'OAE S11', label: 'S11', engineer: 'Matheus Ramos' },
    { id: 'OAE S12', label: 'S12', engineer: 'Matheus Ramos' },
    { id: 'OAE S13', label: 'S13', engineer: 'Rafael Requiao' },
    { id: 'OAE S14', label: 'S14', engineer: 'Rafael Requiao' },
    { id: 'OAE D15', label: 'D15', engineer: 'Bruno Bastos' },
    { id: 'OAE D16', label: 'D16', engineer: 'Bruno Bastos' },
    { id: 'OAE D17', label: 'D17', engineer: 'Bruno Bastos' },
    { id: 'OAE D18', label: 'D18', engineer: 'Bruno Bastos' },
    { id: 'OAE D19', label: 'D19', engineer: 'Matheus Ramos' },
    { id: 'OAE D20', label: 'D20', engineer: 'Matheus Ramos' },
    { id: 'OAE D21', label: 'D21', engineer: 'Matheus Ramos' },
    { id: 'OAE D22', label: 'D22', engineer: 'Rafael Requiao' },
    { id: 'OAE D23', label: 'D23', engineer: 'Rafael Requiao' },
    { id: 'OAE D24', label: 'D24', engineer: 'Rafael Requiao' },
    { id: 'Quadratum', label: 'Quadratum', engineer: 'Bruno Bastos' },
    { id: 'Pátio de vigas', label: 'Pátio de vigas', engineer: 'Matheus Ramos' },
];

const WR_ENGINEER_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    'Bruno Bastos': { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)', text: '#93c5fd', dot: '#3b82f6' },
    'Matheus Ramos': { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', text: '#6ee7b7', dot: '#10b981' },
    'Rafael Requiao': { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.5)', text: '#fcd34d', dot: '#f59e0b' },
};

const SlideVisualControl: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const oaeData = useMemo(() => {
        const today = new Date(todayStr + 'T12:00:00');

        // Mapear tasks do dia para cada OAE
        const result: { oaeId: string; label: string; engineer: string; tasks: { title: string; assignee: string; support?: string; shift?: string }[] }[] = [];

        WAR_ROOM_OAE_LIST.forEach(oae => {
            const matchingTasks: { title: string; assignee: string; support?: string; shift?: string }[] = [];

            tasks.forEach(task => {
                if (!task.location) return;
                const taskStart = new Date(task.startDate + 'T00:00:00');
                const taskEnd = new Date(task.dueDate + 'T23:59:59');
                if (today < taskStart || today > taskEnd) return;

                const loc = task.location.toUpperCase().trim();
                if (
                    loc.includes(oae.id.toUpperCase()) ||
                    loc.includes(oae.label) ||
                    loc === oae.id.toUpperCase()
                ) {
                    matchingTasks.push({
                        title: task.title,
                        assignee: task.assignee || '',
                        support: task.support || undefined,
                        shift: task.shift || undefined,
                    });
                }
            });

            if (matchingTasks.length > 0) {
                result.push({
                    oaeId: oae.id,
                    label: oae.label,
                    engineer: oae.engineer,
                    tasks: matchingTasks,
                });
            }
        });

        return result;
    }, [tasks, todayStr]);

    // Resumos
    const summary = useMemo(() => {
        const byEngineer: Record<string, number> = {};
        let totalTasks = 0;
        oaeData.forEach(oae => {
            totalTasks += oae.tasks.length;
            byEngineer[oae.engineer] = (byEngineer[oae.engineer] || 0) + oae.tasks.length;
        });
        return { activeOAEs: oaeData.length, totalTasks, byEngineer };
    }, [oaeData]);

    const dateFormatted = useMemo(() => {
        return new Date(todayStr + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long'
        });
    }, [todayStr]);

    return (
        <div className="h-full flex flex-col items-center justify-start px-8 pt-4 overflow-hidden">
            <div className="text-center mb-6">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Execuções do Dia</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">Atividades do dia — {dateFormatted}</p>
            </div>

            {/* Summary badges */}
            <div className="flex items-center gap-6 mb-6 flex-shrink-0">
                <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/5 px-8 py-4 text-center" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.1)' }}>
                    <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-[3px] mb-1">OAEs Ativas</p>
                    <p className="text-5xl font-black text-blue-400 tracking-tighter">{summary.activeOAEs}</p>
                </div>
                <div className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/5 px-8 py-4 text-center" style={{ boxShadow: '0 0 40px rgba(227,90,16,0.1)' }}>
                    <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-[3px] mb-1">Atividades Hoje</p>
                    <p className="text-5xl font-black text-brand-accent tracking-tighter">{summary.totalTasks}</p>
                </div>
                {/* Per-engineer badges */}
                {Object.entries(summary.byEngineer).map(([eng, count]) => {
                    const colors = WR_ENGINEER_COLORS[eng] || WR_ENGINEER_COLORS['Bruno Bastos'];
                    return (
                        <div key={eng} className="bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/5 px-6 py-4 text-center" style={{ boxShadow: `0 0 30px ${colors.bg}` }}>
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.dot }}></div>
                                <p className="text-[9px] font-black uppercase tracking-[2px]" style={{ color: colors.text }}>{eng}</p>
                            </div>
                            <p className="text-3xl font-black tracking-tighter" style={{ color: colors.dot }}>{count}</p>
                        </div>
                    );
                })}
            </div>

            {/* OAE Cards Grid */}
            <div className="w-full max-w-7xl flex-1 min-h-0 overflow-auto">
                {oaeData.length > 0 ? (
                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                        {oaeData.map(oae => {
                            const colors = WR_ENGINEER_COLORS[oae.engineer] || WR_ENGINEER_COLORS['Bruno Bastos'];
                            return (
                                <div
                                    key={oae.oaeId}
                                    className="rounded-xl border p-3 transition-all"
                                    style={{
                                        backgroundColor: colors.bg,
                                        borderColor: colors.border,
                                        boxShadow: `0 0 12px ${colors.bg}`,
                                    }}
                                >
                                    {/* OAE Header */}
                                    <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: `1px solid ${colors.border}` }}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-white" style={{ backgroundColor: colors.dot }}>
                                                {oae.label.length <= 3 ? oae.label : '●'}
                                            </div>
                                            <span className="text-xs font-black" style={{ color: colors.text }}>{oae.oaeId}</span>
                                        </div>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(200,200,200,0.6)' }}>
                                            {oae.tasks.length} ativ.
                                        </span>
                                    </div>

                                    {/* Task list */}
                                    <div className="space-y-1">
                                        {oae.tasks.slice(0, 5).map((task, i) => (
                                            <div key={i} className="text-[9px] font-semibold text-gray-300 flex items-start gap-1">
                                                {task.support && (
                                                    <span className="text-orange-400 font-bold shrink-0">[{task.support}]</span>
                                                )}
                                                {task.shift && (
                                                    <span className="shrink-0 opacity-70">{task.shift === 'Diurno' ? '☀️' : '🌙'}</span>
                                                )}
                                                <span className="truncate">• {task.title}</span>
                                            </div>
                                        ))}
                                        {oae.tasks.length > 5 && (
                                            <div className="text-[8px] font-bold italic" style={{ color: colors.text }}>+{oae.tasks.length - 5} mais...</div>
                                        )}
                                    </div>

                                    {/* Assignees */}
                                    {oae.tasks.some(t => t.assignee) && (
                                        <div className="mt-2 pt-1.5" style={{ borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                                            <div className="text-[8px] font-semibold text-gray-400 truncate">
                                                👷 {[...new Set(oae.tasks.map(t => t.assignee).filter(Boolean))].join(', ')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-brand-med-gray text-xl italic">Nenhuma atividade programada para hoje</div>
                )}
            </div>
        </div>
    );
};

// ==============================
// COMPONENTE PRINCIPAL — WAR ROOM TV
// ==============================
const WarRoomTVPage: React.FC<WarRoomTVPageProps> = ({ onNavigateToHome }) => {
    const { tasks, baselineTasks } = useData();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const slides = useMemo(() => [
        { id: 'summary', title: 'Resumo Geral', component: <SlideTaskSummary tasks={tasks} /> },
        { id: 'ppc', title: 'Curva PPC', component: <SlidePPC tasks={tasks} /> },
        { id: 'performance', title: 'Performance', component: <SlidePerformance tasks={tasks} /> },
        { id: 'level', title: 'Por Nível', component: <SlideLevel tasks={tasks} /> },
        { id: 'ppcAccumulated', title: 'PPC Acumulado', component: <SlidePPCAccumulated tasks={tasks} /> },
        { id: 'visualControl', title: 'Execuções do Dia', component: <SlideVisualControl tasks={tasks} /> },
    ], [tasks, baselineTasks]);

    // Auto-rotate every 15 seconds
    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 15000);
        return () => clearInterval(timer);
    }, [isPaused, slides.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                setCurrentSlide(prev => (prev + 1) % slides.length);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length);
            } else if (e.key === 'p' || e.key === 'P') {
                setIsPaused(prev => !prev);
            } else if (e.key === 'Escape') {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                    setIsFullscreen(false);
                } else if (onNavigateToHome) {
                    onNavigateToHome();
                }
            } else if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slides.length, onNavigateToHome]);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // Progress bar for 15s timer
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        if (isPaused) return;
        setProgress(0);
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) return 0;
                return prev + (100 / 150); // 150 steps over 15 seconds (100ms each)
            });
        }, 100);
        return () => clearInterval(interval);
    }, [currentSlide, isPaused]);

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fixed inset-0 bg-[#020408] text-white overflow-hidden flex flex-col z-50" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-8 py-4 bg-[#0a0f18]/80 backdrop-blur-xl border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/20">
                        <ConstructionIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tighter uppercase">ELOS <span className="text-brand-accent">War Room</span></h1>
                        <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-[3px]">Painel de Controle em Tempo Real</p>
                    </div>
                </div>

                {/* Slide indicators */}
                <div className="flex items-center gap-3">
                    {slides.map((slide, i) => (
                        <button
                            key={slide.id}
                            onClick={() => setCurrentSlide(i)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${i === currentSlide
                                ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/30'
                                : 'bg-white/5 text-brand-med-gray hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {slide.title}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs font-bold text-white capitalize">{dateStr}</p>
                        <p className="text-2xl font-black text-brand-accent tracking-tighter">{timeStr}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPaused(prev => !prev)}
                            className={`p-2 rounded-lg transition-all ${isPaused ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-brand-med-gray hover:text-white'}`}
                            title={isPaused ? 'Retomar (P)' : 'Pausar (P)'}
                        >
                            {isPaused ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            )}
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg bg-white/5 text-brand-med-gray hover:text-white transition-all"
                            title="Tela Cheia (F)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {isFullscreen ? (
                                    <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
                                ) : (
                                    <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
                                )}
                            </svg>
                        </button>
                        {onNavigateToHome && (
                            <button
                                onClick={onNavigateToHome}
                                className="p-2 rounded-lg bg-white/5 text-brand-med-gray hover:bg-red-500/20 hover:text-red-500 transition-all"
                                title="Sair (Esc)"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-white/5 flex-shrink-0">
                <div
                    className="h-full bg-gradient-to-r from-brand-accent via-orange-400 to-brand-accent transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(227,90,16,0.03)_0%,_transparent_60%)]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,_rgba(59,130,246,0.03)_0%,_transparent_60%)]"></div>

                {/* Slide Content */}
                <div className="relative h-full" key={currentSlide}>
                    <div className="h-full animate-fade-in">
                        {slides[currentSlide].component}
                    </div>
                </div>
            </div>

            {/* Bottom Navigation Dots */}
            <div className="flex items-center justify-center gap-2 py-3 bg-[#0a0f18]/60 backdrop-blur-xl border-t border-white/5 flex-shrink-0">
                {slides.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        className={`rounded-full transition-all duration-300 ${i === currentSlide
                            ? 'w-8 h-2 bg-brand-accent shadow-lg shadow-brand-accent/40'
                            : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                            }`}
                    />
                ))}
                <span className="ml-4 text-[10px] text-brand-med-gray font-bold">
                    {currentSlide + 1} / {slides.length}
                    {isPaused && <span className="ml-2 text-yellow-400 animate-pulse">⏸ PAUSADO</span>}
                </span>
                <span className="ml-4 text-[9px] text-brand-med-gray/50 font-medium">
                    ← → Navegar • P Pausar • F Tela Cheia • Esc Sair
                </span>
            </div>
        </div>
    );
};

export default WarRoomTVPage;
