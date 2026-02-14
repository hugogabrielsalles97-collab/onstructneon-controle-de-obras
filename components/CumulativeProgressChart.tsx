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

    const sortedTasks = [...tasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const projectStart = new Date(sortedTasks[0].startDate);
    const tasksEnd = new Date(Math.max(...tasks.map(t => new Date(t.dueDate).getTime())));

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Gráfico vai até o final previsto ou até hoje, o que for maior
    const endDateBoundary = new Date(Math.max(tasksEnd.getTime(), today.getTime()));

    const data = [];
    let currentDate = new Date(projectStart);
    currentDate.setHours(23, 59, 59, 999);

    const totalTasks = tasks.length;

    while (currentDate <= endDateBoundary) {
      const dateStr = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const currentMs = currentDate.getTime();

      // --- Cálculo do Previsto (Pondearado pelo progresso no tempo) ---
      let sumPlanned = 0;
      tasks.forEach(task => {
        const start = new Date(task.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(task.dueDate);
        end.setHours(23, 59, 59, 999);

        if (currentMs < start.getTime()) {
          sumPlanned += 0;
        } else if (currentMs >= end.getTime()) {
          sumPlanned += 100;
        } else {
          const duration = end.getTime() - start.getTime();
          const elapsed = currentMs - start.getTime();
          // Evitar divisão por zero
          sumPlanned += duration > 0 ? (elapsed / duration) * 100 : 100;
        }
      });
      const plannedPercent = totalTasks > 0 ? Math.round(sumPlanned / totalTasks) : 0;

      // --- Cálculo do Realizado (Baseado no progresso físico real reportado) ---
      let actualPercent: number | null = null;

      // Só calculamos realizado até o dia de hoje
      if (currentDate <= today) {
        let sumActual = 0;
        tasks.forEach(task => {
          if (!task.actualStartDate) return; // Não iniciada contribui com 0

          const start = new Date(task.actualStartDate);
          start.setHours(0, 0, 0, 0);

          // O "alvo" da interpolação é o fim real (se acabou) ou hoje (se em andamento)
          let endTargetMs = today.getTime();

          if (task.status === TaskStatus.Completed && task.actualEndDate) {
            const end = new Date(task.actualEndDate);
            end.setHours(23, 59, 59, 999);
            endTargetMs = end.getTime();
          }

          if (currentMs < start.getTime()) {
            sumActual += 0;
          } else if (currentMs >= endTargetMs) {
            // Se já passou da data alvo, o progresso é o que está consolidado na tarefa
            sumActual += task.progress;
          } else {
            // Interpolação linear do progresso atual ao longo do tempo decorrido
            const duration = endTargetMs - start.getTime();
            const elapsed = currentMs - start.getTime();
            const ratio = duration > 0 ? elapsed / duration : 1;
            sumActual += ratio * task.progress;
          }
        });
        actualPercent = totalTasks > 0 ? Math.round(sumActual / totalTasks) : 0;
      }

      data.push({
        date: dateStr,
        'Previsto': plannedPercent,
        'Realizado': actualPercent,
      });

      // Avançar 1 dia
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(23, 59, 59, 999);
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