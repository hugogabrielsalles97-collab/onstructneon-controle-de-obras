
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, TaskStatus } from '../types';
import { useData } from '../context/DataProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend, AreaChart, Area, ComposedChart, Line } from 'recharts';
import ConstructionIcon from './icons/ConstructionIcon';

interface WarRoomTVPageProps {
    onNavigateToHome?: () => void;
    showToast?: (message: string, type: 'success' | 'error') => void;
}

// ==============================
// SLIDE 1 COMBINADO — PPC SEMANAL E ACUMULADO
// ==============================
const SlidePPCCombined: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    // Lógica PPC Semanal
    const weeklyData = useMemo(() => {
        if (tasks.length === 0) return [];
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
            if (taskDueDate > lastClosedWeekEnd) return;
            if (taskDueDate >= start && taskDueDate <= end) {
                const d = new Date(taskDueDate);
                d.setDate(d.getDate() - d.getDay());
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
    }, [tasks]);

    // Lógica PPC Acumulado
    const accumulatedData = useMemo(() => {
        if (tasks.length === 0) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        const lastClosedWeekEnd = new Date(currentWeekStart);
        lastClosedWeekEnd.setDate(lastClosedWeekEnd.getDate() - 1);

        const tasksByWeek: { weekStart: Date; weekEnd: Date; key: string; total: number; completed: number }[] = [];
        const allDates = tasks.flatMap(t => [new Date(t.startDate), new Date(t.dueDate)]);
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

        const current = new Date(minDate);
        current.setDate(current.getDate() - current.getDay());

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
            const isAfterLastClosed = week.weekStart > lastClosedWeekEnd;
            return {
                name: `${week.key}`,
                planejado: Math.round((week.total / tasks.length) * 100),
                realizado: isAfterLastClosed ? null : Math.round((week.completed / tasks.length) * 100),
            };
        });
    }, [tasks]);

    const averagePpc = useMemo(() => {
        if (weeklyData.length === 0) return 0;
        return Math.round(weeklyData.reduce((acc, d) => acc + d.ppc, 0) / weeklyData.length);
    }, [weeklyData]);

    return (
        <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-6">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Acompanhamento PPC</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">Análise de cumprimento de metas e tendência de avanço</p>
            </div>

            <div className="grid grid-cols-2 gap-8 w-full max-w-[95%] h-[550px]">
                {/* Lado Esquerdo: PPC Semanal */}
                <div className="bg-[#111827]/40 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white uppercase tracking-wider">Curva PPC</h3>
                        <div className="bg-brand-accent/20 px-3 py-1 rounded-lg border border-brand-accent/30">
                            <span className="text-brand-accent font-black text-2xl">{averagePpc}%</span>
                            <span className="text-[9px] text-brand-med-gray uppercase font-bold ml-2">Média</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 24, fontWeight: '900' }} axisLine={false} tickLine={false} />
                                <YAxis stroke="#64748b" tick={{ fontSize: 20, fontWeight: '800' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0a0f18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '18px' }}
                                />
                                <ReferenceLine y={averagePpc} stroke="#e35a10" strokeDasharray="5 5" strokeWidth={2} />
                                <Bar dataKey="ppc" name="PPC %" radius={[4, 4, 0, 0]} barSize={25}>
                                    {weeklyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.ppc >= 80 ? '#22c55e' : entry.ppc >= 50 ? '#eab308' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Lado Direito: PPC Acumulado */}
                <div className="bg-[#111827]/40 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col">
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-4">PPC Acumulado</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={accumulatedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 24, fontWeight: '700' }} axisLine={false} tickLine={false} />
                                <YAxis stroke="#64748b" tick={{ fontSize: 20, fontWeight: '700' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0f18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '18px' }} />
                                <Area type="monotone" dataKey="planejado" stroke="#3b82f6" strokeWidth={3} fill="url(#colorPlanejado)" name="Plan. %" />
                                <Area type="monotone" dataKey="realizado" stroke="#22c55e" strokeWidth={3} fill="url(#colorRealizado)" name="Real. %" connectNulls={false} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '18px', fontWeight: '800', textTransform: 'uppercase', paddingTop: '10px' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==============================
// SLIDE 3 — DESEMPENHO POR RESPONSÁVEL
// ==============================
const SlidePerformance: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const todayNum = new Date().setHours(0, 0, 0, 0);

    const data = useMemo(() => {
        const assigneeMap: { [key: string]: { total: number; onTime: number; late: number; overdue: number; open: number } } = {};

        tasks.forEach(task => {
            const assignee = task.assignee || 'Sem Responsável';
            if (!assigneeMap[assignee]) assigneeMap[assignee] = { total: 0, onTime: 0, late: 0, overdue: 0, open: 0 };
            assigneeMap[assignee].total++;

            if (task.status === TaskStatus.Completed) {
                if (task.actualEndDate && task.dueDate) {
                    const actualEnd = new Date(task.actualEndDate + 'T00:00:00').getTime();
                    const dueLimit = new Date(task.dueDate + 'T23:59:59').getTime();
                    if (actualEnd <= dueLimit) assigneeMap[assignee].onTime++;
                    else assigneeMap[assignee].late++;
                } else {
                    assigneeMap[assignee].onTime++;
                }
            } else if (new Date(task.dueDate + 'T00:00:00').getTime() < todayNum) {
                assigneeMap[assignee].overdue++;
            } else {
                assigneeMap[assignee].open++;
            }
        });

        return Object.entries(assigneeMap)
            .map(([name, stats]) => {
                const resolved = stats.onTime + stats.late + stats.overdue;
                const onTimeRate = resolved > 0 ? Math.round((stats.onTime / resolved) * 100) : (stats.open > 0 ? 100 : 0);
                return {
                    name: name.length > 25 ? name.substring(0, 25) + '…' : name,
                    fullName: name,
                    noPrazo: stats.onTime,
                    foraDoPrazo: stats.late,
                    emAberto: stats.open,
                    atrasadas: stats.overdue,
                    total: stats.total,
                    onTimeRate,
                    resolved
                };
            })
            .filter(item => item.resolved > 0 || item.total >= 3)
            .sort((a, b) => b.onTimeRate - a.onTimeRate || a.atrasadas - b.atrasadas)
            .slice(0, 10);
    }, [tasks, todayNum]);

    return (
        <div className="h-full flex flex-col items-center justify-center px-12">
            <div className="text-center mb-8">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Performance por Responsável</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase italic">Análise de cumprimento de prazos e ranking de eficiência por executor</p>
            </div>

            <div className="grid grid-cols-3 gap-8 w-full max-w-[95%] h-[580px]">
                {/* Gráfico de Barras */}
                <div className="col-span-2 bg-[#111827]/40 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-8 text-[12px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-green-500"></div> <span className="text-green-400">No Prazo</span></div>
                            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-yellow-500"></div> <span className="text-yellow-400">Fora do Prazo</span></div>
                            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-blue-500"></div> <span className="text-blue-400">Em Aberto</span></div>
                            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-red-500"></div> <span className="text-red-400">Atrasadas</span></div>
                        </div>
                    </div>
                    
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 22, fontWeight: '700' }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" width={220} stroke="#f8fafc" tick={{ fontSize: 20, fontWeight: '700' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0a0f18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', fontSize: '18px', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="noPrazo" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="foraDoPrazo" stackId="a" fill="#eab308" />
                                <Bar dataKey="emAberto" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="atrasadas" stackId="a" fill="#ef4444" radius={[0, 8, 8, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Ranking List */}
                <div className="bg-[#111827]/40 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col relative overflow-hidden">
                    <h3 className="text-xl font-bold text-brand-accent uppercase tracking-wider mb-6 pb-4 border-b border-white/5">🏆 Top Performance</h3>
                    <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                        {data.map((item, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`;
                            const barColor = item.onTimeRate >= 80 ? 'bg-green-500' : item.onTimeRate >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                            return (
                                <div key={item.fullName} className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-brand-accent/30 transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{medal}</span>
                                            <span className="text-sm font-black text-white truncate max-w-[150px] uppercase">{item.fullName}</span>
                                        </div>
                                        <span className={`text-2xl font-black ${item.onTimeRate >= 80 ? 'text-green-400' : item.onTimeRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{item.onTimeRate}%</span>
                                    </div>
                                    <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden mb-2">
                                        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${item.onTimeRate}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-brand-med-gray font-black uppercase tracking-widest">
                                        <span>{item.noPrazo} No Prazo</span>
                                        <span className={item.atrasadas > 0 ? 'text-red-500' : 'text-green-500'}>{item.atrasadas > 0 ? `${item.atrasadas} Atrasadas` : '0 Atrasadas'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-brand-med-gray/50 font-bold uppercase italic text-center">
                        KPI: No Prazo / (Concluídas + Atrasadas)
                    </div>
                </div>
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
                        <div className="col-span-2 text-[14px] font-black text-brand-med-gray uppercase tracking-[2px]">Nível</div>
                        <div className="text-[14px] font-black text-brand-med-gray uppercase tracking-[2px] text-center">Total</div>
                        <div className="text-[14px] font-black text-green-500 uppercase tracking-[2px] text-center">Concluídas</div>
                        <div className="text-[14px] font-black text-blue-400 uppercase tracking-[2px] text-center">Andamento</div>
                        <div className="text-[14px] font-black text-red-500 uppercase tracking-[2px] text-center">Atrasadas</div>
                        <div className="text-[14px] font-black text-brand-accent uppercase tracking-[2px] text-center">% Conclusão</div>
                    </div>

                    {data.map((item, i) => (
                        <div key={item.level} className="grid grid-cols-7 gap-3 bg-[#111827]/60 backdrop-blur-xl rounded-2xl border border-white/5 px-6 py-5 items-center hover:border-brand-accent/20 transition-all" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className="col-span-2 text-white font-bold text-lg">{item.level}</div>
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
// SLIDE 2 — PPC Acumulado (PLANEJAMENTO MENSAL)
// ==============================
const SlideScurve: React.FC<{ data: any[] }> = ({ data }) => {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];
        let accP1 = 0, accP2 = 0, accReal = 0;
        let p1Reached100 = false, p2Reached100 = false, realReached100 = false;

        return data.map(m => {
            accP1 += (m.planned1 || 0);
            accP2 += (m.planned2 || 0);
            let currentAccReal: number | null = null;
            if (m.actual !== null && m.actual !== undefined) {
                accReal += m.actual;
                currentAccReal = accReal;
            }

            const [year, month] = m.month.split('-');
            const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
            const label = `${months[parseInt(month) - 1]}/${year.slice(-2)}`;

            const chartP1 = p1Reached100 ? null : accP1;
            const chartP2 = p2Reached100 ? null : accP2;
            const chartReal = (realReached100 || currentAccReal === null) ? null : currentAccReal;

            if (accP1 >= 99.99) p1Reached100 = true;
            if (accP2 >= 99.99) p2Reached100 = true;
            if (currentAccReal !== null && currentAccReal >= 99.99) realReached100 = true;

            return {
                label,
                'LB01 (Mês)': m.planned1,
                'LB04 (Mês)': m.planned2,
                'Real (Mês)': m.actual,
                'LB01 (Acum)': chartP1,
                'LB04 (Acum)': chartP2,
                'Real (Acum)': chartReal
            };
        });
    }, [data]);

    return (
        <div className="h-full flex flex-col items-center justify-center px-8">
            <div className="text-center mb-6">
                <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">PPC Acumulado</h2>
                <p className="text-brand-med-gray text-lg font-medium tracking-widest uppercase">LB01 vs LB04 vs Realizado</p>
            </div>

            <div className="w-full max-w-[95%] h-[580px] bg-[#111827]/40 backdrop-blur-xl rounded-3xl border border-white/5 p-8">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 24, fontWeight: '900' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 20, fontWeight: '800' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} label={{ value: 'Mensal', angle: -90, position: 'insideLeft', fontSize: 20, fill: '#94a3b8', fontWeight: 'bold' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 20, fontWeight: '800' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} label={{ value: 'Acumulado', angle: 90, position: 'insideRight', fontSize: 20, fill: '#94a3b8', fontWeight: 'bold' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0a0f18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '12px' }} itemStyle={{ fontSize: '18px', fontWeight: '900' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase' }} />
                        <Bar yAxisId="left" dataKey="LB04 (Mês)" fill="rgba(139, 92, 246, 0.4)" radius={[4, 4, 0, 0]} barSize={12} name="LB04 (Mês)" />
                        <Bar yAxisId="left" dataKey="Real (Mês)" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={12} name="Realizado (Mês)" />
                        <Bar yAxisId="left" dataKey="LB01 (Mês)" fill="rgba(227, 90, 16, 0.4)" radius={[4, 4, 0, 0]} barSize={12} name="LB01 (Mês)" />
                        <Line yAxisId="right" type="monotone" dataKey="LB01 (Acum)" stroke="#e35a10" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} name="LB01 (Acum)" />
                        <Line yAxisId="right" type="monotone" dataKey="LB04 (Acum)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} name="LB04 (Acum)" />
                        <Line yAxisId="right" type="monotone" dataKey="Real (Acum)" stroke="#06b6d4" strokeWidth={4} dot={{ r: 3 }} connectNulls={false} name="Realizado (Acum)" />
                    </ComposedChart>
                </ResponsiveContainer>
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
    const { tasks, monthlyPlanning } = useData();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const slides = useMemo(() => [
        { id: 'ppcCombined', title: 'Acompanhamento PPC', component: <SlidePPCCombined tasks={tasks} /> },
        { id: 'scurve', title: 'Curva S', component: <SlideScurve data={monthlyPlanning} /> },
        { id: 'performance', title: 'Performance', component: <SlidePerformance tasks={tasks} /> },
        { id: 'level', title: 'Por Nível', component: <SlideLevel tasks={tasks} /> },
        { id: 'visualControl', title: 'Execuções do Dia', component: <SlideVisualControl tasks={tasks} /> },
    ], [tasks, monthlyPlanning]);

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
