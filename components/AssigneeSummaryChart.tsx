import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Task } from '../types';

interface AssigneeSummaryChartProps {
  tasks: Task[];
}

const PALETTE = ['#e35a10', '#06b6d4', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#f97316', '#10b981'];

const AssigneeSummaryChart: React.FC<AssigneeSummaryChartProps> = ({ tasks }) => {
  const data = useMemo(() => {
    const summary: Record<string, { totalProgress: number; count: number }> = {};
    for (const task of tasks) {
      if (!summary[task.assignee]) {
        summary[task.assignee] = { totalProgress: 0, count: 0 };
      }
      summary[task.assignee].totalProgress += task.progress;
      summary[task.assignee].count++;
    }

    return Object.entries(summary).map(([assigneeName, { totalProgress, count }]) => ({
      name: assigneeName,
      progress: count > 0 ? totalProgress / count : 0,
    })).sort((a, b) => b.progress - a.progress);
  }, [tasks]);

  const barHeight = 45;
  const baseHeight = 100;
  const chartHeight = Math.max(300, data.length * barHeight + baseHeight);

  return (
    <div style={{ height: `${chartHeight}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
          layout="vertical"
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            stroke="#9d9d9c"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 10, fontWeight: '700' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#9d9d9c"
            width={120}
            tick={{ fontSize: 11, fontWeight: '600', fill: '#f3f4f6' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${(typeof value === 'number' ? value.toFixed(1) : value)}%`, 'Progresso Médio']}
            contentStyle={{
              backgroundColor: '#0a0f18',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.75rem',
              fontSize: '11px',
              fontWeight: '700'
            }}
            itemStyle={{ color: '#f3f4f6' }}
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
          />
          <Bar dataKey="progress" name="Progresso Médio">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AssigneeSummaryChart;