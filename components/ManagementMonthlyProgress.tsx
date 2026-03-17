import React, { useState, useMemo } from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import ExcelIcon from './icons/ExcelIcon';
import { exportToExcel } from '../utils/excelExport';

export interface MonthlyProgress {
    month: string; // 'YYYY-MM'
    planned1: number; // Percentual no mês
    planned2: number; // Percentual no mês
    actual?: number | null; // Percentual no mês
}

interface ManagementMonthlyProgressProps {
    data: MonthlyProgress[];
    onSave: (newData: MonthlyProgress[]) => void;
}

const ManagementMonthlyProgress: React.FC<ManagementMonthlyProgressProps> = ({ data, onSave }) => {
    const [editingData, setEditingData] = useState<MonthlyProgress[]>(data);
    const [isEditing, setIsEditing] = useState(false);

    // Sincronizar com dados do banco quando carregarem
    React.useEffect(() => {
        if (data && data.length > 0) {
            setEditingData(data);
        }
    }, [data]);

    // Gerar meses se não existirem (ex: 12 meses a partir do primeiro ou do atual)
    const months = useMemo(() => {
        if (editingData.length > 0) return editingData;
        
        const result: MonthlyProgress[] = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            result.push({
                month: d.toISOString().substring(0, 7),
                planned1: 0,
                planned2: 0,
                actual: null
            });
        }
        return result;
    }, [editingData]);

    const chartData = useMemo(() => {
        let accP1 = 0;
        let accP2 = 0;
        let accReal = 0;
        let foundLastReal = false;

        return months.map(m => {
            accP1 += m.planned1;
            accP2 += m.planned2;
            
            let currentAccReal: number | null = null;
            if (m.actual !== null && m.actual !== undefined) {
                accReal += m.actual;
                currentAccReal = accReal;
            } else {
                foundLastReal = true;
            }

            const [year, month] = m.month.split('-');
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
            const label = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');

            // Novas variáveis para interrupção em 100%
            const chartP1 = accP1 > 100.1 ? null : accP1;
            const chartP2 = accP2 > 100.1 ? null : accP2;
            const chartReal = (currentAccReal !== null && currentAccReal > 100.1) ? null : currentAccReal;

            return {
                ...m,
                label,
                'LB01 (Mês)': m.planned1,
                'LB04 (Mês)': m.planned2,
                'Real (Mês)': m.actual,
                'LB01 (Acum)': chartP1,
                'LB04 (Acum)': chartP2,
                'Real (Acum)': chartReal
            };
        });
    }, [months]);

    const handleInputChange = (index: number, field: keyof MonthlyProgress, value: string) => {
        const newValue = value === '' ? (field === 'actual' ? null : 0) : parseFloat(value);
        const newData = [...editingData];
        if (newData.length === 0) {
           // Se vazio, inicializa com os meses calculados
           const initialData = [...months];
           (initialData[index] as any)[field] = newValue;
           setEditingData(initialData);
        } else {
            (newData[index] as any)[field] = newValue;
            setEditingData(newData);
        }
    };

    const handleSave = () => {
        onSave(editingData.length > 0 ? editingData : months);
        setIsEditing(false);
    };

    const handleAddMonth = () => {
        const lastMonth = editingData.length > 0 ? editingData[editingData.length - 1].month : months[months.length - 1].month;
        const [year, month] = lastMonth.split('-').map(Number);
        const nextDate = new Date(year, month, 1);
        const nextMonthStr = nextDate.toISOString().substring(0, 7);
        
        setEditingData(prev => [
            ...(prev.length > 0 ? prev : months),
            { month: nextMonthStr, planned1: 0, planned2: 0, actual: null }
        ]);
    };

    const handleAddPreviousMonth = () => {
        const firstMonth = editingData.length > 0 ? editingData[0].month : months[0].month;
        const [year, month] = firstMonth.split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1);
        const prevMonthStr = prevDate.toISOString().substring(0, 7);
        
        setEditingData(prev => [
            { month: prevMonthStr, planned1: 0, planned2: 0, actual: null },
            ...(prev.length > 0 ? prev : months)
        ]);
    };

    const handleRemoveLastMonth = () => {
        setEditingData(prev => {
            const base = prev.length > 0 ? prev : months;
            return base.slice(0, -1);
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-brand-dark/50 p-4 rounded-xl border border-brand-darkest">
                <div>
                    <h3 className="text-lg font-bold text-white">Planejamento Mensal e Curva S</h3>
                    <p className="text-xs text-brand-med-gray">Insira os percentuais previstos e realizados mês a mês para gerar a Curva S do projeto.</p>
                </div>
                <div className="flex gap-3">
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-brand-accent/20 text-brand-accent border border-brand-accent/50 rounded-lg text-xs font-bold hover:bg-brand-accent hover:text-white transition-all"
                        >
                            Editar Planilha
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 bg-brand-dark text-brand-med-gray border border-brand-darkest rounded-lg text-xs font-bold hover:bg-brand-dark/50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className="bg-brand-dark/80 rounded-xl border border-brand-darkest overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-brand-darkest text-brand-med-gray uppercase font-black tracking-widest">
                                <tr>
                                    <th className="p-4 border-b border-brand-dark">Mês</th>
                                    <th className="p-4 border-b border-brand-dark">LB01 (%)</th>
                                    <th className="p-4 border-b border-brand-dark">LB04 (%)</th>
                                    <th className="p-4 border-b border-brand-dark text-brand-accent">Realizado (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-darkest/50">
                                {(editingData.length > 0 ? editingData : months).map((m, idx) => (
                                    <tr key={m.month} className="hover:bg-brand-accent/5 transition-colors">
                                        <td className="p-4 text-white font-bold whitespace-nowrap">
                                            {new Date(parseInt(m.month.split('-')[0]), parseInt(m.month.split('-')[1]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={m.planned1}
                                                onChange={(e) => handleInputChange(idx, 'planned1', e.target.value)}
                                                className="w-full bg-brand-darkest border border-brand-dark rounded p-2 text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={m.planned2}
                                                onChange={(e) => handleInputChange(idx, 'planned2', e.target.value)}
                                                className="w-full bg-brand_darkest border border-brand-dark rounded p-2 text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={m.actual === null ? '' : m.actual}
                                                onChange={(e) => handleInputChange(idx, 'actual', e.target.value)}
                                                placeholder="Pendente"
                                                className="w-full bg-brand-darkest border border-brand-accent/20 rounded p-2 text-brand-accent focus:ring-1 focus:ring-brand-accent outline-none placeholder:text-brand-accent/30"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-brand-darkest/50 flex gap-6">
                        <button
                            onClick={handleAddPreviousMonth}
                            className="text-[10px] text-brand-accent font-black uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                            <span className="text-sm">↑</span> Adicionar Mês Anterior
                        </button>
                        <button
                            onClick={handleAddMonth}
                            className="text-[10px] text-brand-accent font-black uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                            <span className="text-sm">↓</span> Adicionar Próximo Mês
                        </button>
                        <button
                            onClick={handleRemoveLastMonth}
                            className="text-[10px] text-red-400 font-black uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                            <span className="text-sm">×</span> Remover Último Mês
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-brand-dark/40 p-6 rounded-2xl border border-brand-darkest shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button 
                         onClick={() => exportToExcel(chartData, 'Curva_S_Mensal')}
                         className="p-2 bg-brand-dark hover:bg-green-600/20 text-brand-med-gray hover:text-green-400 rounded-lg border border-brand-darkest transition-all"
                         title="Exportar dados do gráfico"
                    >
                        <ExcelIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <h4 className="text-[10px] font-black text-brand-med-gray uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                    Visualização Curva S (Previsto vs Realizado)
                </h4>

                <div className="h-[450px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis 
                                dataKey="label" 
                                stroke="#6366f1" 
                                tick={{ fontSize: 10, fontWeight: '700' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis 
                                yAxisId="left"
                                stroke="#94a3b8"
                                tick={{ fontSize: 10, fontWeight: '700' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => `${v}%`}
                                label={{ value: 'Mensal', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                            />
                            <YAxis 
                                yAxisId="right"
                                orientation="right"
                                stroke="#94a3b8"
                                tick={{ fontSize: 10, fontWeight: '700' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => `${v}%`}
                                domain={[0, 100]}
                                label={{ value: 'Acumulado', angle: 90, position: 'insideRight', fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#0a0f18', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '1rem',
                                    padding: '12px',
                                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)'
                                }}
                                itemStyle={{ fontSize: '11px', fontWeight: '700' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Legend 
                                wrapperStyle={{ paddingTop: '30px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}
                            />
                            
                            {/* Barras Mensais */}
                            <Bar 
                                yAxisId="left" 
                                dataKey="LB04 (Mês)" 
                                fill="rgba(139, 92, 246, 0.4)" 
                                radius={[4, 4, 0, 0]} 
                                barSize={20}
                                name="LB04 (Mês)"
                            />
                            <Bar 
                                yAxisId="left" 
                                dataKey="Real (Mês)" 
                                fill="#06b6d4" 
                                radius={[4, 4, 0, 0]} 
                                barSize={20}
                                name="Realizado (Mês)"
                            />
                            <Bar 
                                yAxisId="left" 
                                dataKey="LB01 (Mês)" 
                                fill="rgba(227, 90, 16, 0.4)" 
                                radius={[4, 4, 0, 0]} 
                                barSize={20}
                                name="LB01 (Mês)"
                            />

                            {/* Linhas Acumuladas */}
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="LB01 (Acum)"
                                stroke="#e35a10"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ r: 3, fill: '#e35a10', strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                                name="LB01 (Acum)"
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="LB04 (Acum)"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                                name="LB04 (Acum)"
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="Real (Acum)"
                                stroke="#06b6d4"
                                strokeWidth={4}
                                dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                connectNulls={false} // IMPORTANTE: interrompe a linha onde não há dado
                                name="Realizado (Acum)"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ManagementMonthlyProgress;
