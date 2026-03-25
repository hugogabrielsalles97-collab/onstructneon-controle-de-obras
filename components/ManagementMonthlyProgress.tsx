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
    Cell,
    ReferenceLine
} from 'recharts';
import ExcelIcon from './icons/ExcelIcon';
import { exportToExcel } from '../utils/excelExport';

export interface WeeklyProgress {
    week: number; // 1, 2, 3, 4, 5
    planned1: number;
    planned2: number;
    actual?: number | null;
}

export interface MonthlyProgress {
    month: string; // 'YYYY-MM'
    planned1: number; // Percentual no mês (ou soma das semanas se expandido)
    planned2: number; // Percentual no mês
    actual?: number | null; // Percentual no mês
    weeks?: WeeklyProgress[]; // Detalhamento opcional por semanas
    isExpanded?: boolean; // Novo: Persistência visual da expansão
}

interface ManagementMonthlyProgressProps {
    data: MonthlyProgress[];
    onSave: (newData: MonthlyProgress[]) => void;
    canEdit?: boolean; // Permissão para alterar planejamento e visual
}

const ManagementMonthlyProgress: React.FC<ManagementMonthlyProgressProps> = ({ data, onSave, canEdit = false }) => {
    const [editingData, setEditingData] = useState<MonthlyProgress[]>(data);
    const [isEditing, setIsEditing] = useState(false);

    const toggleMonthExpansion = (index: number) => {
        if (!canEdit) return; // Só masters/planejadores podem alterar o "visual" salvo
        
        const newData = [...(editingData.length > 0 ? editingData : months)];
        newData[index] = {
            ...newData[index],
            isExpanded: !newData[index].isExpanded
        };
        setEditingData(newData);
        
        // Se NÃO estiver em modo de edição da planilha, salvamos o visual IMEDIATAMENTE 
        // para persistir para todos, conforme pedido pelo usuário.
        if (!isEditing) {
            onSave(newData);
        }
    };

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
        
        let p1Reached100 = false;
        let p2Reached100 = false;
        let realReached100 = false;

        const flatData: any[] = [];
        
        months.forEach((m, mIdx) => {
            if (m.isExpanded) {
                // Se expandido, adiciona 4 pontos semanais
                const weeks = m.weeks || [
                    { week: 1, planned1: m.planned1 / 4, planned2: m.planned2 / 4, actual: m.actual !== null ? m.actual / 4 : null },
                    { week: 2, planned1: m.planned1 / 4, planned2: m.planned2 / 4, actual: m.actual !== null ? m.actual / 4 : null },
                    { week: 3, planned1: m.planned1 / 4, planned2: m.planned2 / 4, actual: m.actual !== null ? m.actual / 4 : null },
                    { week: 4, planned1: m.planned1 / 4, planned2: m.planned2 / 4, actual: m.actual !== null ? m.actual / 4 : null },
                ];
                
                weeks.forEach((w, wIdx) => {
                    accP1 += w.planned1;
                    accP2 += w.planned2;
                    let currentAccReal: number | null = null;
                    if (w.actual !== null && w.actual !== undefined) {
                        accReal += w.actual;
                        currentAccReal = accReal;
                    }

                    const [year, monthNum] = m.month.split('-');
                    const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                    const monthShort = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).substring(0, 3);
                    const yearShort = year.substring(2);
                    
                    const lastDayOfMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
                    const weekRange = w.week === 1 ? '01-07' : w.week === 2 ? '08-15' : w.week === 3 ? '16-22' : `23-${lastDayOfMonth}`;
                    
                    if (accP1 >= 99.99) p1Reached100 = true;
                    if (accP2 >= 99.99) p2Reached100 = true;
                    if (currentAccReal !== null && currentAccReal >= 99.99) realReached100 = true;

                    // Regra de interrupção da LB04 em Fev/27
                    const isAfterP2Cutoff = m.month > '2027-02';

                    flatData.push({
                        label: `${monthShort}/${yearShort} S${w.week} (${weekRange})`,
                        monthShort: `${monthShort}/${yearShort}`,
                        weekLabel: `S${w.week}`,
                        'LB01 (Mês)': w.planned1,
                        'LB04 (Mês)': w.planned2,
                        'Real (Mês)': w.actual,
                        'LB01 (Acum)': p1Reached100 && accP1 > 100.1 ? null : accP1,
                        'LB04 (Acum)': (p2Reached100 && accP2 > 100.1) || isAfterP2Cutoff ? null : accP2,
                        'Real (Acum)': (realReached100 && currentAccReal === null) || currentAccReal === null ? null : currentAccReal,
                        isWeekly: true
                    });
                });
            } else {
                // Comportamento normal mensal
                accP1 += m.planned1;
                accP2 += m.planned2;
                
                let currentAccReal: number | null = null;
                if (m.actual !== null && m.actual !== undefined) {
                    accReal += m.actual;
                    currentAccReal = accReal;
                }

                const [year, monthNum] = m.month.split('-');
                const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                const monthShort = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).substring(0, 3);
                const yearShort = year.substring(2);
                const label = `${monthShort}/${yearShort}`;

                if (accP1 >= 99.99) p1Reached100 = true;
                if (accP2 >= 99.99) p2Reached100 = true;
                if (currentAccReal !== null && currentAccReal >= 99.99) realReached100 = true;

                // Regra de interrupção da LB04 em Fev/27
                const isAfterP2Cutoff = m.month > '2027-02';

                flatData.push({
                    ...m,
                    label,
                    monthShort: label,
                    'LB01 (Mês)': m.planned1,
                    'LB04 (Mês)': m.planned2,
                    'Real (Mês)': m.actual,
                    'LB01 (Acum)': p1Reached100 && accP1 > 100.1 ? null : accP1,
                    'LB04 (Acum)': (p2Reached100 && accP2 > 100.1) || isAfterP2Cutoff ? null : accP2,
                    'Real (Acum)': (realReached100 && currentAccReal === null) || currentAccReal === null ? null : currentAccReal
                });
            }
        });

        return flatData;
    }, [months]);

    const handleInputChange = (index: number, field: keyof MonthlyProgress, value: string, weekIdx?: number) => {
        const newValue = value === '' ? (field === 'actual' ? null : 0) : parseFloat(value);
        const newData = [...(editingData.length > 0 ? editingData : months)];
        
        if (weekIdx !== undefined) {
            // Atualizar semana específica
            const month = { ...newData[index] };
            if (!month.weeks) {
                month.weeks = [
                    { week: 1, planned1: month.planned1 / 4, planned2: month.planned2 / 4, actual: month.actual !== null ? month.actual / 4 : null },
                    { week: 2, planned1: month.planned1 / 4, planned2: month.planned2 / 4, actual: month.actual !== null ? month.actual / 4 : null },
                    { week: 3, planned1: month.planned1 / 4, planned2: month.planned2 / 4, actual: month.actual !== null ? month.actual / 4 : null },
                    { week: 4, planned1: month.planned1 / 4, planned2: month.planned2 / 4, actual: month.actual !== null ? month.actual / 4 : null },
                ];
            }
            const updatedWeek = { ...month.weeks[weekIdx] };
            (updatedWeek as any)[field] = newValue;
            month.weeks = [...month.weeks];
            month.weeks[weekIdx] = updatedWeek;
            
            // Recalcular total do mês baseado nas semanas
            month.planned1 = month.weeks.reduce((acc, w) => acc + (w.planned1 || 0), 0);
            month.planned2 = month.weeks.reduce((acc, w) => acc + (w.planned2 || 0), 0);
            const actualSum = month.weeks.reduce((acc, w) => acc + (w.actual || 0), 0);
            const hasAnyReal = month.weeks.some(w => w.actual !== null && w.actual !== undefined);
            month.actual = hasAnyReal ? actualSum : null;
            
            newData[index] = month;
        } else {
            // Atualizar mês e limpar semanas (ou avisar?) — por agora, mantemos semanas se existirem
            (newData[index] as any)[field] = newValue;
            // Se o usuário mexer no total mensal MANUALMENTE, talvez queira redistribuir? 
            // Por simplicidade, se ele mexer no total, mantemos o que ele digitou.
        }
        
        setEditingData(newData);
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

    const CustomXAxisTick = (props: any) => {
        const { x, y, payload } = props;
        const dataPoint = chartData[payload.index];
        if (!dataPoint) return null;

        if (dataPoint.isWeekly) {
            return (
                <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={12} textAnchor="middle" fill="#6366f1" fontSize={9} fontWeight="900" textTransform="uppercase">
                        {dataPoint.weekLabel}
                    </text>
                    <text x={0} y={12} dy={12} textAnchor="middle" fill="#94a3b8" fontSize={8} fontWeight="700">
                        {dataPoint.monthShort}
                    </text>
                </g>
            );
        }

        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={14} textAnchor="middle" fill="#6366f1" fontSize={10} fontWeight="800">
                    {payload.value}
                </text>
            </g>
        );
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
                        canEdit && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-brand-accent/20 text-brand-accent border border-brand-accent/50 rounded-lg text-xs font-bold hover:bg-brand-accent hover:text-white transition-all"
                            >
                                Editar Planilha
                            </button>
                        )
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
                                {(editingData.length > 0 ? editingData : months).map((m, idx) => {
                                    const isExpanded = !!m.isExpanded;
                                    const dateObj = new Date(parseInt(m.month.split('-')[0]), parseInt(m.month.split('-')[1]) - 1, 1);
                                    
                                    return (
                                        <React.Fragment key={m.month}>
                                            <tr className={`${isExpanded ? 'bg-brand-accent/10' : 'hover:bg-brand-accent/5'} transition-colors border-l-2 ${isExpanded ? 'border-brand-accent' : 'border-transparent'}`}>
                                                <td className="p-4 text-white font-bold whitespace-nowrap flex items-center gap-3">
                                                    <button 
                                                        onClick={() => toggleMonthExpansion(idx)}
                                                        disabled={!canEdit}
                                                        className={`w-6 h-6 rounded flex items-center justify-center transition-all ${isExpanded ? 'bg-brand-accent text-white rotate-90' : 'bg-white/5 text-brand-med-gray hover:text-white'}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                    {dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={m.planned1}
                                                        disabled={isExpanded} // Se expandido, o total vem das semanas
                                                        onChange={(e) => handleInputChange(idx, 'planned1', e.target.value)}
                                                        className={`w-full bg-brand-darkest border border-brand-dark rounded p-2 text-white focus:ring-1 focus:ring-brand-accent outline-none ${isExpanded ? 'opacity-50' : ''}`}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={m.planned2}
                                                        disabled={isExpanded}
                                                        onChange={(e) => handleInputChange(idx, 'planned2', e.target.value)}
                                                        className={`w-full bg-brand-darkest border border-brand-dark rounded p-2 text-white focus:ring-1 focus:ring-brand-accent outline-none ${isExpanded ? 'opacity-50' : ''}`}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={m.actual === null ? '' : m.actual}
                                                        disabled={isExpanded}
                                                        onChange={(e) => handleInputChange(idx, 'actual', e.target.value)}
                                                        placeholder={isExpanded ? "Calculado" : "Pendente"}
                                                        className={`w-full bg-brand-darkest border border-brand-accent/20 rounded p-2 text-brand-accent focus:ring-1 focus:ring-brand-accent outline-none placeholder:text-brand-accent/30 ${isExpanded ? 'opacity-50' : ''}`}
                                                    />
                                                </td>
                                            </tr>
                                            {isExpanded && (m.weeks || [
                                                { week: 1, planned1: m.planned1/4, planned2: m.planned2/4, actual: m.actual !== null ? m.actual/4 : null },
                                                { week: 2, planned1: m.planned1/4, planned2: m.planned2/4, actual: m.actual !== null ? m.actual/4 : null },
                                                { week: 3, planned1: m.planned1/4, planned2: m.planned2/4, actual: m.actual !== null ? m.actual/4 : null },
                                                { week: 4, planned1: m.planned1/4, planned2: m.planned2/4, actual: m.actual !== null ? m.actual/4 : null }
                                            ]).map((w, wIdx) => (
                                                <tr key={`${m.month}-w${wIdx}`} className="bg-white/5 animate-fade-in">
                                                    <td className="p-3 pl-14 text-brand-med-gray text-[10px] font-bold uppercase tracking-wider">
                                                        {(wIdx === 0 ? '01-07' : wIdx === 1 ? '08-15' : wIdx === 2 ? '16-22' : `23-${new Date(parseInt(m.month.split('-')[0]), parseInt(m.month.split('-')[1]), 0).getDate()}`)}
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={w.planned1}
                                                            onChange={(e) => handleInputChange(idx, 'planned1', e.target.value, wIdx)}
                                                            className="w-full bg-brand-dark border border-brand-darkest rounded p-1 text-[11px] text-gray-300 focus:ring-1 focus:ring-brand-accent outline-none"
                                                        />
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={w.planned2}
                                                            onChange={(e) => handleInputChange(idx, 'planned2', e.target.value, wIdx)}
                                                            className="w-full bg-brand-dark border border-brand-darkest rounded p-1 text-[11px] text-gray-300 focus:ring-1 focus:ring-brand-accent outline-none"
                                                        />
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={w.actual === null ? '' : w.actual}
                                                            onChange={(e) => handleInputChange(idx, 'actual', e.target.value, wIdx)}
                                                            className="w-full bg-brand-dark border border-brand-accent/10 rounded p-1 text-[11px] text-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
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
                                tick={<CustomXAxisTick />}
                                height={50}
                                interval={0} // Garante que todas as semanas apareçam
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

                            {/* Linha indicando o "hoje" ou último dado real */}
                            {(() => {
                                const lastReal = [...chartData].reverse().find(d => d['Real (Acum)'] !== null);
                                if (!lastReal) return null;
                                return (
                                    <ReferenceLine 
                                        x={lastReal.label} 
                                        stroke="#06b6d4" 
                                        strokeWidth={1}
                                        strokeDasharray="5 5"
                                        yAxisId="right"
                                        label={{ 
                                            value: 'Realizado até aqui', 
                                            position: 'top', 
                                            fill: '#06b6d4', 
                                            fontSize: 8, 
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase'
                                        }}
                                    />
                                );
                            })()}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ManagementMonthlyProgress;
