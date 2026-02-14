
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Task, TaskStatus } from '../types';

interface StatusChartProps {
  tasks: Task[];
}

type DisplayStatus = TaskStatus | 'Atrasado';

const COLORS: Record<DisplayStatus, string> = {
  [TaskStatus.ToDo]: '#eab308', // yellow-500
  [TaskStatus.InProgress]: '#06b6d4', // cyan-500
  [TaskStatus.Completed]: '#22c55e', // green-500
  'Atrasado': '#ef4444', // red-500
};

const StatusChart: React.FC<StatusChartProps> = ({ tasks }) => {
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts = tasks.reduce((acc, task) => {
      const dueDate = new Date(task.dueDate + 'T00:00:00');
      const isOverdue = dueDate < today && task.status !== TaskStatus.Completed;
      const displayStatus: DisplayStatus = isOverdue ? 'Atrasado' : task.status;

      acc[displayStatus] = (acc[displayStatus] || 0) + 1;
      return acc;
    }, {} as Record<DisplayStatus, number>);

    return Object.entries(counts).map(([name, value]) => ({
      name: name as DisplayStatus,
      value,
    }));
  }, [tasks]);

  if (tasks.length === 0) {
    return <div className="flex items-center justify-center h-full text-brand-med-gray italic text-sm">Nenhuma tarefa para exibir.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          nameKey="name"
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name]} />
          ))}
        </Pie>
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
          iconType="circle"
          wrapperStyle={{
            fontSize: "10px",
            fontWeight: '800',
            color: '#9d9d9c',
            textTransform: 'uppercase',
            paddingTop: '10px'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default StatusChart;