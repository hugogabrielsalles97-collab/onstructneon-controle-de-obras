import React, { useState, useMemo } from 'react';
import ExcelIcon from './icons/ExcelIcon';
import { exportToExcel } from '../utils/excelExport';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  ResponsiveContainer, Line, ComposedChart, Area, ReferenceLine, Cell, LabelList
} from 'recharts';

export interface WeeklyDisciplineProgress {
    week: number;
    planned: number;
    actual?: number | null;
}

export interface DisciplineMonthProgress {
    discipline: string;
    month: string; // 'YYYY-MM'
    planned: number; 
    actual?: number | null;
    weeks?: WeeklyDisciplineProgress[];
    isExpanded?: boolean;
}

interface ManagementDisciplineProgressProps {
    data: DisciplineMonthProgress[];
    onSave: (newData: DisciplineMonthProgress[]) => void;
    canEdit?: boolean;
    availableDisciplines: string[];
}

const ManagementDisciplineProgress: React.FC<ManagementDisciplineProgressProps> = ({ data, onSave, canEdit = false, availableDisciplines }) => {
    const [editingData, setEditingData] = useState<DisciplineMonthProgress[]>(data);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedChartDiscipline, setSelectedChartDiscipline] = useState<string>('');

    const chartDisciplines = useMemo(() => {
        const discSet = new Set<string>();
        editingData.forEach(d => { if (d.discipline) discSet.add(d.discipline); });
        const list = Array.from(discSet).sort();
        if (list.length > 0 && !selectedChartDiscipline) {
            setSelectedChartDiscipline(list[0]);
        }
        return list;
    }, [editingData]);

    const toggleExpansion = (index: number) => {
        if (!canEdit) return;
        const newData = [...editingData];
        newData[index] = { ...newData[index], isExpanded: !newData[index].isExpanded };
        setEditingData(newData);
        if (!isEditing) onSave(newData);
    };

    const handleInputChange = (index: number, field: 'planned' | 'actual', value: string, weekIdx?: number) => {
        const newValue = value === '' ? (field === 'actual' ? null : 0) : parseFloat(value);
        const newData = [...editingData];
        const item = { ...newData[index] };

        if (weekIdx !== undefined) {
            if (!item.weeks) {
                item.weeks = [
                    { week: 1, planned: item.planned / 4, actual: item.actual !== null ? (item.actual ?? 0) / 4 : null },
                    { week: 2, planned: item.planned / 4, actual: item.actual !== null ? (item.actual ?? 0) / 4 : null },
                    { week: 3, planned: item.planned / 4, actual: item.actual !== null ? (item.actual ?? 0) / 4 : null },
                    { week: 4, planned: item.planned / 4, actual: item.actual !== null ? (item.actual ?? 0) / 4 : null },
                ];
            }
            const updatedWeek = { ...item.weeks[weekIdx] };
            (updatedWeek as any)[field] = newValue;
            item.weeks = [...item.weeks];
            item.weeks[weekIdx] = updatedWeek;

            // Recalcular total do mês
            item.planned = item.weeks.reduce((acc, w) => acc + (w.planned || 0), 0);
            const hasAnyReal = item.weeks.some(w => w.actual !== null && w.actual !== undefined);
            item.actual = hasAnyReal ? item.weeks.reduce((acc, w) => acc + (w.actual || 0), 0) : null;
        } else {
            (item as any)[field] = newValue;
        }

        newData[index] = item;
        setEditingData(newData);
    };

    const handleDisciplineChange = (index: number, discipline: string) => {
        const newData = [...editingData];
        newData[index] = { ...newData[index], discipline };
        setEditingData(newData);
    };

    const handleAddRow = () => {
        const monthRows = editingData.filter(d => d.month !== 'INITIAL');
        const lastMonth = monthRows.length > 0 ? monthRows[monthRows.length - 1].month : new Date().toISOString().substring(0, 7);
        // Pegar disciplinas únicas já usadas, ou as disponíveis se estiver vazio
        const activeDisciplines = editingData.length > 0 
            ? Array.from(new Set(editingData.map(d => d.discipline))) 
            : availableDisciplines;

        const newRows = activeDisciplines.map(disc => ({
            discipline: disc,
            month: lastMonth,
            planned: 0,
            actual: null
        }));
        
        setEditingData([...editingData, ...newRows]);
    };

    const handleAddInitialRow = () => {
        const activeDisciplines = editingData.length > 0 
            ? Array.from(new Set(editingData.map(d => d.discipline))) 
            : availableDisciplines;

        const newRows = activeDisciplines.map(disc => ({
            discipline: disc,
            month: 'INITIAL',
            planned: 0,
            actual: 0
        }));
        
        setEditingData([...editingData, ...newRows]);
    };

    const handleRemoveRow = (index: number) => {
        setEditingData(editingData.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onSave(editingData);
        setIsEditing(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-brand-dark/50 p-4 rounded-xl border border-brand-darkest">
                <div>
                    <h3 className="text-lg font-bold text-white">Avanço Físico por Disciplina</h3>
                    <p className="text-xs text-brand-med-gray">Gerencie o planejamento e o avanço realizado para cada disciplina do projeto.</p>
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
                                    <th className="p-4 border-b border-brand-dark">Disciplina</th>
                                    <th className="p-4 border-b border-brand-dark">Mês</th>
                                    <th className="p-4 border-b border-brand-dark">Previsto (%)</th>
                                    <th className="p-4 border-b border-brand-dark">Previsto Acum. (%)</th>
                                    <th className="p-4 border-b border-brand-dark text-brand-accent">Realizado (%)</th>
                                    <th className="p-4 border-b border-brand-dark text-brand-accent">Realizado Acum. (%)</th>
                                    <th className="p-4 border-b border-brand-dark"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-darkest/50">
                                {editingData.map((m, idx) => {
                                    const isExpanded = !!m.isExpanded;
                                    const isInitial = m.month === 'INITIAL';
                                    
                                    // Cálculo de acumulados para esta disciplina até este mês
                                    const disciplineData = editingData
                                        .filter(item => item.discipline === m.discipline)
                                        .sort((a, b) => {
                                            if (a.month === 'INITIAL') return -1;
                                            if (b.month === 'INITIAL') return 1;
                                            return a.month.localeCompare(b.month);
                                        });
                                    
                                    const currentIdxInGroup = disciplineData.findIndex(item => item.month === m.month);
                                    const dataUntilNow = disciplineData.slice(0, currentIdxInGroup + 1);
                                    
                                    const accPlanned = dataUntilNow.reduce((acc, item) => acc + (item.planned || 0), 0);
                                    
                                    const hasAnyRealInHistory = dataUntilNow.some(item => item.actual !== null && item.actual !== undefined);
                                    const accActual = hasAnyRealInHistory ? dataUntilNow.reduce((acc, item) => acc + (item.actual || 0), 0) : null;

                                    return (
                                        <React.Fragment key={idx}>
                                            <tr className={`${isExpanded ? 'bg-brand-accent/10' : 'hover:bg-brand-accent/5'} transition-colors border-l-2 ${isExpanded ? 'border-brand-accent' : 'border-transparent'}`}>
                                                <td className="p-2">
                                                    <input
                                                        list="disciplines-list"
                                                        value={m.discipline}
                                                        onChange={(e) => handleDisciplineChange(idx, e.target.value)}
                                                        className="w-full bg-brand-darkest border border-brand-dark rounded p-2 text-white focus:ring-1 focus:ring-brand-accent outline-none font-bold placeholder:font-normal"
                                                        placeholder="Digite a disciplina..."
                                                    />
                                                    <datalist id="disciplines-list">
                                                        {availableDisciplines.map(d => (
                                                            <option key={d} value={d} />
                                                        ))}
                                                    </datalist>
                                                </td>
                                                <td className="p-4 text-white font-bold whitespace-nowrap flex items-center gap-2">
                                                    {!isInitial ? (
                                                        <>
                                                            <button 
                                                                onClick={() => toggleExpansion(idx)}
                                                                className={`w-6 h-6 rounded flex items-center justify-center transition-all ${isExpanded ? 'bg-brand-accent text-white rotate-90' : 'bg-white/5 text-brand-med-gray hover:text-white'}`}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                            <input 
                                                                type="month"
                                                                value={m.month}
                                                                onChange={(e) => {
                                                                    const newData = [...editingData];
                                                                    newData[idx] = { ...newData[idx], month: e.target.value };
                                                                    setEditingData(newData);
                                                                }}
                                                                className="bg-transparent border-none text-white focus:ring-0 outline-none w-32"
                                                            />
                                                        </>
                                                    ) : (
                                                        <span className="text-[10px] text-brand-accent uppercase font-black tracking-widest pl-1">Saldo Anterior</span>
                                                    )}
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={m.planned}
                                                        disabled={isExpanded}
                                                        onChange={(e) => handleInputChange(idx, 'planned', e.target.value)}
                                                        className={`w-full bg-brand-darkest border border-brand-dark rounded p-2 text-white focus:ring-1 focus:ring-brand-accent outline-none ${isExpanded ? 'opacity-50' : ''}`}
                                                    />
                                                </td>
                                                <td className="p-2 text-brand-med-gray font-mono text-[10px] text-center">
                                                    {accPlanned.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={m.actual === null ? '' : m.actual}
                                                        disabled={isExpanded}
                                                        onChange={(e) => handleInputChange(idx, 'actual', e.target.value)}
                                                        placeholder="Pendente"
                                                        className={`w-full bg-brand-darkest border border-brand-accent/20 rounded p-2 text-brand-accent focus:ring-1 focus:ring-brand-accent outline-none placeholder:text-brand-accent/30 ${isExpanded ? 'opacity-50' : ''}`}
                                                    />
                                                </td>
                                                <td className="p-2 text-brand-accent/80 font-mono text-[10px] text-center">
                                                    {accActual !== null ? `${accActual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '-'}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button 
                                                        onClick={() => handleRemoveRow(idx)}
                                                        className="text-red-400 hover:text-red-300 transition-colors"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded && (m.weeks || [
                                                { week: 1, planned: m.planned/4, actual: m.actual !== null ? (m.actual ?? 0)/4 : null },
                                                { week: 2, planned: m.planned/4, actual: m.actual !== null ? (m.actual ?? 0)/4 : null },
                                                { week: 3, planned: m.planned/4, actual: m.actual !== null ? (m.actual ?? 0)/4 : null },
                                                { week: 4, planned: m.planned/4, actual: m.actual !== null ? (m.actual ?? 0)/4 : null }
                                            ]).map((w, wIdx) => (
                                                <tr key={`${idx}-w${wIdx}`} className="bg-white/5 animate-fade-in shadow-inner">
                                                    <td className="p-2"></td>
                                                    <td className="p-3 pl-14 text-brand-med-gray text-[10px] font-bold uppercase tracking-wider">
                                                        S{wIdx + 1}
                                                    </td>
                                                    <td className="p-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={w.planned}
                                                            onChange={(e) => handleInputChange(idx, 'planned', e.target.value, wIdx)}
                                                            className="w-full bg-brand-dark border border-brand-darkest rounded p-1 text-[11px] text-gray-300 focus:ring-1 focus:ring-brand-accent outline-none"
                                                        />
                                                    </td>
                                                    <td className="p-1"></td>
                                                    <td className="p-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={w.actual === null ? '' : w.actual}
                                                            onChange={(e) => handleInputChange(idx, 'actual', e.target.value, wIdx)}
                                                            className="w-full bg-brand-dark border border-brand-accent/10 rounded p-1 text-[11px] text-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
                                                            placeholder="Pendente"
                                                        />
                                                    </td>
                                                    <td className="p-1 text-center"></td>
                                                    <td className="p-1 text-center"></td>
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
                            onClick={handleAddRow}
                            className="text-[10px] text-brand-accent font-black uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                            <span className="text-sm">+</span> Mês de Planejamento
                        </button>
                        <button
                            onClick={handleAddInitialRow}
                            className="text-[10px] text-brand-med-gray hover:text-white font-black uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                            <span className="text-sm">+</span> Saldo Anterior (Acumulado)
                        </button>
                    </div>
                </div>
            )}

            {/* Seção do Gráfico de Disciplinas */}
            <div className="bg-brand-dark/40 rounded-2xl border border-brand-darkest p-6 shadow-2xl space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">
                            Análise de Desempenho por Disciplina
                        </h4>
                        <p className="text-[10px] text-brand-med-gray">Visualize os desvios e o progresso acumulado de forma detalhada.</p>
                    </div>
                    <div className="flex gap-2 bg-brand-darkest p-1 rounded-lg border border-brand-dark">
                        {chartDisciplines.map(disc => (
                            <button
                                key={disc}
                                onClick={() => setSelectedChartDiscipline(disc)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${selectedChartDiscipline === disc ? 'bg-brand-accent text-white shadow-lg' : 'text-brand-med-gray hover:text-white hover:bg-white/5'}`}
                            >
                                {disc}
                            </button>
                        ))}
                    </div>
                </div>

                {(() => {
                    // Processamento de dados para o gráfico
                    const filteredData = editingData.filter(d => d.discipline === selectedChartDiscipline);

                    // Se não houver dados
                    if (filteredData.length === 0) {
                        return (
                            <div className="h-[300px] flex items-center justify-center text-brand-med-gray text-xs italic">
                                Nenhuma informação de planejamento inserida para esta disciplina.
                            </div>
                        );
                    }

                    // Agrupar por mês/período
                    const groupedByPeriod: { [key: string]: { planned: number, actual: number | null, isWeekly?: boolean, month?: string } } = {};
                    
                    filteredData.forEach(m => {
                        if (m.month === 'INITIAL') return;
                        
                        if (m.isExpanded && m.weeks) {
                            m.weeks.forEach((w, wIdx) => {
                                const key = `${m.month}-S${wIdx + 1}`;
                                if (!groupedByPeriod[key]) groupedByPeriod[key] = { planned: 0, actual: null, isWeekly: true, month: m.month };
                                groupedByPeriod[key].planned += w.planned || 0;
                                if (w.actual !== null && w.actual !== undefined) {
                                    groupedByPeriod[key].actual = (groupedByPeriod[key].actual || 0) + w.actual;
                                }
                            });
                        } else {
                            if (!groupedByPeriod[m.month]) groupedByPeriod[m.month] = { planned: 0, actual: null, month: m.month };
                            groupedByPeriod[m.month].planned += m.planned || 0;
                            if (m.actual !== null && m.actual !== undefined) {
                                groupedByPeriod[m.month].actual = (groupedByPeriod[m.month].actual || 0) + m.actual;
                            }
                        }
                    });

                    // Obter saldo inicial global para a seleção
                    const initialItems = filteredData.filter(d => d.month === 'INITIAL');
                    const startPlanned = initialItems.reduce((acc, d) => acc + (d.planned || 0), 0);
                    const startActual = initialItems.reduce((acc, d) => acc + (d.actual || 0), 0);

                    // Ordenar e calcular acumulados
                    const sortedPeriods = Object.keys(groupedByPeriod).sort();
                    
                    let lastValidPlannedIndex = -1;
                    sortedPeriods.forEach((key, idx) => {
                        if (groupedByPeriod[key].planned > 0) lastValidPlannedIndex = idx;
                    });

                    let currentAccPlanned = startPlanned;
                    let currentAccActual = startActual;
                    let lastValidActualIndex = -1;

                    const chartPoints = sortedPeriods.map((key, idx) => {
                        const p = groupedByPeriod[key];
                        currentAccPlanned += p.planned;
                        const hasActual = p.actual !== null;
                        if (hasActual) {
                            currentAccActual += p.actual || 0;
                            lastValidActualIndex = idx;
                        }

                        const monthDate = new Date(parseInt(p.month!.split('-')[0]), parseInt(p.month!.split('-')[1]) - 1);
                        const monthLabel = monthDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '') + '/' + monthDate.getFullYear().toString().slice(-2);
                        const label = p.isWeekly ? `S${key.split('-S')[1]} (${monthLabel})` : monthLabel;

                        return {
                            name: label,
                            periodo: key,
                            planned: p.planned,
                            actual: p.actual,
                            accPlanned: idx <= lastValidPlannedIndex ? currentAccPlanned : null,
                            accActual: hasActual ? currentAccActual : null
                        };
                    });

                    // Cálculo de KPIs
                    const totalPlanned = chartPoints.reduce((acc, p) => acc + p.planned, 0) + startPlanned;
                    const totalActual = (lastValidActualIndex >= 0 ? chartPoints[lastValidActualIndex].accActual : startActual) || 0;
                    const expectedUntilNow = (lastValidActualIndex >= 0 ? chartPoints[lastValidActualIndex].accPlanned : startPlanned) || 0;
                    const deviation = totalActual - expectedUntilNow;
                    const status = deviation >= 0 ? 'ADiantada' : 'Atrasada';
                    
                    return (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-brand-darkest/50 p-4 rounded-xl border border-brand-darkest">
                                    <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-widest">Realizado Acumulado</p>
                                    <p className="text-2xl font-black text-white">{totalActual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                                        <div className="h-full bg-brand-accent shadow-[0_0_10px_rgba(6,182,212,0.5)]" style={{ width: `${Math.min(100, totalActual)}%` }}></div>
                                    </div>
                                </div>
                                <div className="bg-brand-darkest/50 p-4 rounded-xl border border-brand-darkest">
                                    <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-widest">Previsto Acumulado</p>
                                    <p className="text-2xl font-black text-brand-med-gray">{expectedUntilNow.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                                        <div className="h-full bg-brand-med-gray/30" style={{ width: `${Math.min(100, expectedUntilNow)}%` }}></div>
                                    </div>
                                </div>
                                <div className="bg-brand-darkest/50 p-4 rounded-xl border border-brand-darkest">
                                    <p className="text-[9px] text-brand-med-gray font-black uppercase tracking-widest">Desvio Acumulado (Gap)</p>
                                    <p className={`text-2xl font-black ${deviation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {deviation > 0 ? '+' : ''}{deviation.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                    </p>
                                    <p className="text-[8px] mt-1 text-brand-med-gray uppercase font-bold">
                                        {deviation >= 0 ? 'Frente ao Planejado' : 'Em relação ao planejamento'}
                                    </p>
                                </div>
                                <div className="bg-brand-darkest/50 p-4 rounded-xl border border-brand-darkest flex flex-col justify-center">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase w-fit tracking-wider ${deviation >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {deviation >= 0 ? 'Status Ok' : 'Atenção Necessária'}
                                    </span>
                                    <p className="text-xs text-white mt-1 font-bold">
                                        {deviation >= 0 ? 'Meta Superada' : 'Recuperação Sugerida'}
                                    </p>
                                </div>
                            </div>

                            <div className="w-full overflow-x-auto custom-scrollbar pb-4">
                                <div style={{ minWidth: `${Math.max(800, chartPoints.length * 50)}px`, height: '400px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartPoints} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} 
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                orientation="left"
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                label={{ value: 'Avanço Mensal (%)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 10, fontWeight: 700 } }}
                                            />
                                            <YAxis 
                                                yAxisId="right"
                                                orientation="right"
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#e35a10', fontSize: 10 }}
                                                label={{ value: 'Acumulado (%)', angle: 90, position: 'insideRight', style: { fill: '#e35a10', fontSize: 10, fontWeight: 700 } }}
                                            />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}
                                                itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                                labelStyle={{ color: '#fff', fontWeight: 'black', marginBottom: '8px', textTransform: 'uppercase', fontSize: '10px' }}
                                            />
                                            <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                            
                                            {/* Barras de Progresso Mensal/Semanal */}
                                            <Bar yAxisId="left" name="Previsto Semana" dataKey="planned" fill="#4b5563" radius={[4, 4, 0, 0]}>
                                                <LabelList 
                                                    dataKey="planned" 
                                                    position="top" 
                                                    style={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                                                    formatter={(val: number) => val > 0 ? `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''} 
                                                />
                                            </Bar>
                                            <Bar yAxisId="left" name="Realizado Semana" dataKey="actual" fill="#e35a10" radius={[4, 4, 0, 0]}>
                                                <LabelList 
                                                    dataKey="actual" 
                                                    position="top" 
                                                    style={{ fill: '#e35a10', fontSize: 9, fontWeight: 'bold' }} 
                                                    formatter={(val: number) => val !== null && val !== undefined && val > 0 ? `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''} 
                                                />
                                            </Bar>
                                            
                                            {/* Linhas de Acumulado */}
                                            <Line 
                                                yAxisId="right" 
                                                type="monotone" 
                                                name="Acumulado Previsto" 
                                                dataKey="accPlanned" 
                                                stroke="#9ca3af" 
                                                strokeWidth={2} 
                                                dot={{ r: 3, fill: '#4b5563', strokeWidth: 2 }} 
                                                strokeDasharray="5 5"
                                                connectNulls={false}
                                            />
                                            <Line 
                                                yAxisId="right" 
                                                type="monotone" 
                                                name="Acumulado Real" 
                                                dataKey="accActual" 
                                                stroke="#e35a10" 
                                                strokeWidth={3} 
                                                dot={{ r: 4, fill: '#e35a10' }}
                                                connectNulls={false}
                                            />

                                            {lastValidActualIndex >= 0 && (
                                                <ReferenceLine 
                                                    yAxisId="right"
                                                    x={chartPoints[lastValidActualIndex].name} 
                                                    stroke="#e35a10" 
                                                    strokeDasharray="3 3"
                                                    label={{ value: 'Corte', position: 'insideBottomRight', fill: '#e35a10', fontSize: 10, fontWeight: 'bold' }}
                                                />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>
        </div>
    );
};

export default ManagementDisciplineProgress;
