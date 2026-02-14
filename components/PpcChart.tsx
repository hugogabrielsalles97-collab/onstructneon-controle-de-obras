import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Task } from '../types';

interface PpcChartProps {
    tasks: Task[];
    baselineTasks: Task[];
    startDate?: string;
    endDate?: string;
}

const PpcChart: React.FC<PpcChartProps> = ({ tasks, baselineTasks, startDate, endDate }) => {
    const chartData = useMemo(() => {
        if (tasks.length === 0) return [];

        const start = startDate ? new Date(startDate + 'T00:00:00') : new Date(Math.min(...tasks.map(t => new Date(t.startDate).getTime())));
        const end = endDate ? new Date(endDate + 'T23:59:59') : new Date(Math.max(...tasks.map(t => new Date(t.dueDate).getTime())));

        // Group by weeks
        const weeks: { [key: string]: { planned: number; completed: number } } = {};

        tasks.forEach(task => {
            const taskDueDate = new Date(task.dueDate + 'T23:59:59'); // Set to end of day

            if (taskDueDate >= start && taskDueDate <= end) {
                // Get week identifier (Sunday to Saturday)
                const d = new Date(taskDueDate);
                d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
                const weekKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                if (!weeks[weekKey]) weeks[weekKey] = { planned: 0, completed: 0 };
                weeks[weekKey].planned += 1;

                // Check if completed on time (or completed generally? PPC usually means on time)
                // Assuming PPC = Plan Percent Complete (Completed On Time / Planned)
                // Strict PPC: Completed on or before Due Date

                if (task.status === 'Concluído' && task.actualEndDate) {
                    const actualEnd = new Date(task.actualEndDate + 'T00:00:00'); // Start of day comparison
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
    }, [tasks, startDate, endDate]);

    const averagePpc = useMemo(() => {
        if (chartData.length === 0) return 0;
        return Math.round(chartData.reduce((acc, d) => acc + d.ppc, 0) / chartData.length);
    }, [chartData]);

    if (chartData.length === 0) {
        return <div className="h-full flex items-center justify-center text-brand-med-gray italic text-sm">Dados insuficientes para gerar a Curva PPC.</div>;
    }

    return (
        <div className="h-full w-full">
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-brand-accent">{averagePpc}%</span>
                    <span className="text-[10px] text-brand-med-gray uppercase font-bold tracking-widest">PPC Médio do Período</span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                        dataKey="name"
                        stroke="#9d9d9c"
                        tick={{ fontSize: 10, fontWeight: '700' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        stroke="#9d9d9c"
                        tick={{ fontSize: 10, fontWeight: '700' }}
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{
                            backgroundColor: '#0a0f18',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '0.75rem',
                            fontSize: '11px',
                            fontWeight: '700'
                        }}
                        itemStyle={{ color: '#f3f4f6' }}
                    />
                    <ReferenceLine
                        y={averagePpc}
                        stroke="#e35a10"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{
                            position: 'right',
                            value: `Média: ${averagePpc}%`,
                            fill: '#e35a10',
                            fontSize: 10,
                            fontWeight: '800'
                        }}
                    />
                    <Bar dataKey="ppc" radius={[6, 6, 0, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.ppc >= 80 ? '#22c55e' : entry.ppc >= 50 ? '#eab308' : '#ef4444'}
                                fillOpacity={0.8}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PpcChart;
