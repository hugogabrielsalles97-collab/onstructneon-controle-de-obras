import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Task, TaskStatus } from '../types';

interface CumulativeProgressChartProps {
  tasks: Task[];
  baselineTasks: Task[];
}

const CumulativeProgressChart: React.FC<CumulativeProgressChartProps> = ({ tasks, baselineTasks }) => {
  const chartData = useMemo(() => {
    if (tasks.length === 0) return [];

    // Filtro para focar nas tarefas criadas (campo)
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const projectStart = new Date(sortedTasks[0].startDate);
    const projectEnd = new Date(Math.max(...tasks.map(t => new Date(t.dueDate).getTime())));
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const data = [];
    let currentDate = new Date(projectStart);

    // Normalização para 0 a 100%
    const totalTasks = tasks.length;

    while (currentDate <= projectEnd) {
      const dateStr = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      // % Previsto: Tarefas que deveriam estar terminadas nesta data
      const plannedCount = tasks.filter(t => new Date(t.dueDate) <= currentDate).length;
      const plannedPercent = totalTasks > 0 ? Math.round((plannedCount / totalTasks) * 100) : 0;

      // % Realizado: Tarefas efetivamente concluídas até esta data
      let actualPercent = null;
      if (currentDate <= today) {
        const completedCount = tasks.filter(t => {
          const completedDate = t.status === TaskStatus.Completed && t.actualEndDate ? new Date(t.actualEndDate) : null;
          return completedDate && completedDate <= currentDate;
        }).length;
        actualPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
      }

      data.push({
        date: dateStr,
        'Previsto': plannedPercent,
        'Realizado': actualPercent,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }
    return data;

  }, [tasks]);

  const tickInterval = chartData.length > 30 ? Math.floor(chartData.length / 15) : 0;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#9d9d9c"
          tick={{ fontSize: 10, fontWeight: '700' }}
          interval={tickInterval}
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
          contentStyle={{
            backgroundColor: '#0a0f18',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.75rem',
            fontSize: '11px',
            fontWeight: '700'
          }}
          itemStyle={{ color: '#f3f4f6' }}
        />
        <Legend
          wrapperStyle={{
            color: '#9d9d9c',
            fontSize: '10px',
            fontWeight: '800',
            paddingTop: '20px',
            textTransform: 'uppercase'
          }}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="Previsto"
          stroke="#e35a10"
          strokeDasharray="6 6"
          strokeWidth={2}
          dot={false}
          name="Previsto"
        />
        <Line
          type="monotone"
          dataKey="Realizado"
          stroke="#06b6d4"
          strokeWidth={4}
          connectNulls={true}
          dot={{ r: 0 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
          name="Realizado"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default CumulativeProgressChart;