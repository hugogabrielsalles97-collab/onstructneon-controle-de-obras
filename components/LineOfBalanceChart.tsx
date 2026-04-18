
import React, { useMemo } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Legend, Line } from 'recharts';
import { Task } from '../types';

interface LineOfBalanceChartProps {
    tasks: Task[];
}

const LineOfBalanceChart: React.FC<LineOfBalanceChartProps> = ({ tasks }) => {
    // 1. Prepare Data
    const data = useMemo(() => {
        // Filter tasks that have Start Date, Level, and Discipline
        const validTasks = tasks.filter(t => t.startDate && t.level && t.discipline); // Show all tasks including completed

        // Get unique Levels and sort them logically (needs custom logic for Térreo, 1, 2...)
        const levels = Array.from(new Set(validTasks.map(t => t.level))).sort((aStr, bStr) => {
            const a = String(aStr);
            const b = String(bStr);
            const aNum = parseInt(a.replace(/\D/g, '')) || 0;
            const bNum = parseInt(b.replace(/\D/g, '')) || 0;
            if (a.toLowerCase().includes('térreo') || a.toLowerCase().includes('subsolo')) return -1;
            if (b.toLowerCase().includes('térreo') || b.toLowerCase().includes('subsolo')) return 1;
            return aNum - bNum;
        });

        // Map levels to Y-axis index
        const levelMap = new Map(levels.map((l, i) => [l, i]));

        // Group by Discipline
        const disciplines = Array.from(new Set(validTasks.map(t => t.discipline)));

        // Create series data for each discipline
        const series = disciplines.map(discipline => {
            const disciplineTasks = validTasks.filter(t => t.discipline === discipline)
                .map(t => ({
                    ...t,
                    x: new Date(t.startDate).getTime(), // X is Time
                    y: levelMap.get(t.level) || 0,     // Y is Level Index
                    levelName: t.level
                }))
                .sort((a, b) => a.y - b.y); // Sort by level to draw lines correctly

            return {
                name: discipline,
                data: disciplineTasks,
                color: getDisciplineColor(String(discipline))
            };
        });

        return { series, levels };
    }, [tasks]);

    // Helper for colors
    function getDisciplineColor(discipline: string) {
        const colors = [
            '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6',
            '#EC4899', '#EF4444', '#14B8A6', '#F97316', '#64748B'
        ];
        let hash = 0;
        for (let i = 0; i < discipline.length; i++) {
            hash = discipline.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    const formatDate = (tick: number) => new Date(tick).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    return (
        <div className="w-full h-[500px] bg-[#0a0f18] p-4 rounded-xl border border-white/5 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>
                    <XAxis
                        type="number"
                        dataKey="x"
                        name="Data"
                        domain={['auto', 'auto']}
                        tickFormatter={formatDate}
                        stroke="#4B5563"
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    />
                    <YAxis
                        type="number"
                        dataKey="y"
                        name="Nível"
                        domain={[0, data.levels.length - 1]}
                        ticks={data.levels.map((_, i) => i)}
                        tickFormatter={(i) => data.levels[i]}
                        stroke="#4B5563"
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    />
                    <ZAxis type="number" range={[50, 50]} /> {/* Fixed dot size */}
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-[#111827] p-3 border border-white/10 rounded-lg shadow-xl text-xs">
                                        <p className="font-bold text-white mb-1">{data.title}</p>
                                        <p className="text-gray-400">Disciplina: <span className="text-brand-accent">{data.discipline}</span></p>
                                        <p className="text-gray-400">Nível: {data.levelName}</p>
                                        <p className="text-gray-400">Início: {new Date(data.x).toLocaleDateString('pt-BR')}</p>
                                        <p className="text-gray-400">Status: {data.status}</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                    />
                    {data.series.map((s) => (
                        <Scatter
                            key={s.name}
                            name={s.name}
                            data={s.data}
                            fill={s.color}
                            line={{ stroke: s.color, strokeWidth: 2 }}
                            shape="circle"
                        />
                    ))}
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};

export default LineOfBalanceChart;
