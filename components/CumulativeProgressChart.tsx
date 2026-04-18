import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Task, TaskStatus } from '../types';

interface CumulativeProgressChartProps {
  tasks: Task[];
  baselineTasks: Task[];
  startDate?: string;
  endDate?: string;
}

const CumulativeProgressChart: React.FC<CumulativeProgressChartProps> = ({ tasks, baselineTasks, startDate, endDate }) => {
  const chartData = useMemo(() => {
    if (tasks.length === 0) return [];

    const sortedTasks = [...tasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const tasksEnd = new Date(Math.max(...tasks.map(t => new Date(t.dueDate).getTime())));
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Limites do gráfico
    const chartStart = startDate ? new Date(startDate + 'T00:00:00') : new Date(sortedTasks[0].startDate);
    const chartEnd = endDate ? new Date(endDate + 'T23:59:59') : new Date(Math.max(tasksEnd.getTime(), today.getTime()));

    // Função helper para calcular progresso em uma data específica
    const calculateAtDate = (date: Date) => {
      const currentMs = date.getTime();
      let sumPlanned = 0;
      let sumActual = 0;
      let totalTasksForActual = 0; // Tarefas que contribuem para o real (iniciadas ou completas) - Não, é sobre o total do escopo.

      // Mantendo a lógica original: média dos percentuais de TODAS as tarefas
      const totalTasks = tasks.length;

      tasks.forEach(task => {
        // -- Planned --
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
          sumPlanned += duration > 0 ? (elapsed / duration) * 100 : 100;
        }

        // -- Actual --
        // Apenas se a data de cálculo for <= hoje (não projetamos futuro real)
        if (date <= today) {
          if (!task.actualStartDate) {
            sumActual += 0;
            return;
          }
          const actStart = new Date(task.actualStartDate);
          actStart.setHours(0, 0, 0, 0);

          // Definição do fim real ou data alvo
          let actEndTargetMs = today.getTime();
          if (task.status === TaskStatus.Completed && task.actualEndDate) {
            const actEnd = new Date(task.actualEndDate);
            actEnd.setHours(23, 59, 59, 999);
            actEndTargetMs = actEnd.getTime();
          }

          if (currentMs < actStart.getTime()) {
            sumActual += 0;
          } else if (currentMs >= actEndTargetMs) {
            sumActual += task.progress;
          } else {
            // Interpolação linear do progresso
            const duration = actEndTargetMs - actStart.getTime();
            const elapsed = currentMs - actStart.getTime();
            const ratio = duration > 0 ? elapsed / duration : 1;
            sumActual += ratio * task.progress;
          }
        }
      });

      return {
        planned: totalTasks > 0 ? Math.round(sumPlanned / totalTasks) : 0,
        actual: date <= today ? (totalTasks > 0 ? Math.round(sumActual / totalTasks) : 0) : null
      };
    };

    // Calcular Offset (valor acumulado antes do início do gráfico)
    let offsetPlanned = 0;
    let offsetActual = 0;

    if (startDate) {
      const dayBefore = new Date(chartStart);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(23, 59, 59, 999);
      const offsets = calculateAtDate(dayBefore);
      offsetPlanned = offsets.planned;
      offsetActual = offsets.actual || 0;
    }

    const data = [];
    let currentDate = new Date(chartStart);
    currentDate.setHours(23, 59, 59, 999);

    while (currentDate <= chartEnd) {
      const dateStr = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const values = calculateAtDate(currentDate);

      // Aplicar offset e garantir que não seja negativo (por arredondamento)
      const finalPlanned = Math.max(0, values.planned - offsetPlanned);
      const finalActual = values.actual !== null ? Math.max(0, values.actual - offsetActual) : null;

      data.push({
        date: dateStr,
        'Previsto': finalPlanned,
        'Realizado': finalActual,
      });

      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(23, 59, 59, 999);
    }
    return data;

  }, [tasks, startDate, endDate]);

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