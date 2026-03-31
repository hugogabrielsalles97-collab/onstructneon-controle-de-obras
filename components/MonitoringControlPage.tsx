import React, { useState, useEffect, useMemo } from 'react';
import { User, Task, TaskStatus } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import { useData } from '../context/DataProvider';

interface MonitoringControlPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToMonitoringControl: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToCost: () => void;
    onNavigateToHome?: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToCheckoutSummary?: () => void;
    onNavigateToOrgSummary?: () => void;
    onNavigateToTeams?: () => void;
    onNavigateToSystem?: () => void;
    onUpgradeClick: () => void;
    onAddTask?: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const TABS = [
    "Estacas", "Blocos", "Pilares", "Travessas", "Pilar Provisório",
    "Fabricação Vigas", "Lançamento Vigas", "Fabricação Pré-Laje", "Montagem Pré-Laje",
    "Transversinas", "Laje", "Laje Elástica", "Laje de Aproximação"
];

interface DailyDataMap {
    [taskId: string]: {
        type?: string;
        [dateKey: string]: any; // either prev/real or type
    }
}

const STORAGE_KEY = '@elos_monitoring_daily_data';
const CUSTOM_ROWS_KEY = '@elos_monitoring_custom_rows';

const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

const MonitoringControlPage: React.FC<MonitoringControlPageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToMonitoringControl,
    onNavigateToWarRoom,
    onNavigateToPodcast,
    onNavigateToCost,
    onNavigateToHome,
    onUpgradeClick,
    onNavigateToOrgChart,
    onNavigateToOrgSummary,
    onNavigateToVisualControl,
    onNavigateToCheckoutSummary,
    onNavigateToTeams,
    onNavigateToSystem,
    onAddTask,
    showToast
}) => {
    const { currentUser: user, tasks, signOut } = useData();

    const [selectedTab, setSelectedTab] = useState(TABS[0]);
    
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    const [dailyData, setDailyData] = useState<DailyDataMap>({});
    
    // Suporte para "linhas manuais" (mocked tasks) se a pessoa quiser adicionar livremente sem criar task real
    const [customRows, setCustomRows] = useState<Task[]>([]);

    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            const stored = localStorage.getItem(STORAGE_KEY);
            let hasLoaded = false;
            if (stored) {
                try { 
                    setDailyData(JSON.parse(stored)); 
                    hasLoaded = true;
                } catch { }
            }
            const storedCustom = localStorage.getItem(CUSTOM_ROWS_KEY);
            if (storedCustom) {
                try { 
                    setCustomRows(JSON.parse(storedCustom)); 
                    hasLoaded = true;
                } catch { }
            }

            // Se não tiver localmente, puxa da seed convertida do Excel original
            if (!hasLoaded) {
                try {
                    const res = await fetch('/monitoring_seed.json');
                    if (res.ok) {
                        const seedData = await res.json();
                        setDailyData(seedData.dailyData || {});
                        setCustomRows(seedData.customRows || []);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData.dailyData || {}));
                        localStorage.setItem(CUSTOM_ROWS_KEY, JSON.stringify(seedData.customRows || []));
                    }
                } catch (e) {
                    console.error("Failed to fetch monitoring seed data", e);
                }
            }
            setIsLoadingData(false);
        };
        loadInitialData();
    }, []);

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    const handleDataChange = (taskId: string, dateKey: string, type: 'prev' | 'real', value: string) => {
        const numValue = value === '' ? 0 : parseFloat(value.replace(',', '.'));
        setDailyData(prev => {
            const newData = { ...prev };
            if (!newData[taskId]) newData[taskId] = {};
            if (!newData[taskId][dateKey]) newData[taskId][dateKey] = { prev: 0, real: 0 };
            
            newData[taskId][dateKey] = {
                ...newData[taskId][dateKey],
                [type]: numValue
            };
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            return newData;
        });
    };

    const handleTypeChange = (taskId: string, value: string) => {
        setDailyData(prev => {
            const newData = { ...prev };
            if (!newData[taskId]) newData[taskId] = {};
            newData[taskId].type = value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            return newData;
        });
    };

    const addCustomRow = () => {
        const newRow: Task = {
            id: `custom_row_${Date.now()}`,
            title: `Nova Linha ${selectedTab}`,
            description: '',
            discipline: selectedTab,
            location: 'S01',
            support: 'Apoio 1',
            assignee: user.name,
            level: 'OAE',
            status: TaskStatus.ToDo,
            progress: 0,
            quantity: 0,
            unit: 'un',
            startDate: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            plannedMachinery: [],
            plannedManpower: []
        };
        
        const updated = [...customRows, newRow];
        setCustomRows(updated);
        localStorage.setItem(CUSTOM_ROWS_KEY, JSON.stringify(updated));
        showToast('Linha de controle adicionada.', 'success');
    };

    const updateCustomRow = (taskId: string, field: keyof Task, val: string) => {
        const updated = customRows.map(r => r.id === taskId ? { ...r, [field]: val } : r);
        setCustomRows(updated);
        localStorage.setItem(CUSTOM_ROWS_KEY, JSON.stringify(updated));
    };

    const deleteCustomRow = (taskId: string) => {
        if (!window.confirm("Deseja remover esta linha manual?")) return;
        const updated = customRows.filter(r => r.id !== taskId);
        setCustomRows(updated);
        localStorage.setItem(CUSTOM_ROWS_KEY, JSON.stringify(updated));
    }

    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Merge system tasks and custom rows
    const allRelevantTasks = useMemo(() => {
        const sysTasks = tasks.filter(t => 
            t.discipline?.toLowerCase() === selectedTab.toLowerCase() || 
            t.title?.toLowerCase().includes(selectedTab.toLowerCase())
        );
        const custTasks = customRows.filter(t => t.discipline === selectedTab);
        return [...sysTasks, ...custTasks].sort((a, b) => (a.location || '').localeCompare(b.location || ''));
    }, [tasks, customRows, selectedTab]);

    const calculateTotals = (taskId: string, type: 'prev' | 'real') => {
        const taskData = dailyData[taskId] || {};
        let sum = 0;
        Object.keys(taskData).forEach(dateKey => {
            // Conta totais independente do mês para um planejamento acumulado fiel, 
            // ou somente no mês se quisermos view isolada. 
            // Para o Excel deles, "PLANEJADO X REAL TOTAL" parece ser total global.
            sum += taskData[dateKey][type] || 0;
        });
        return sum;
    };

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="monitoringControl"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToMonitoringControl={onNavigateToMonitoringControl}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToPodcast={onNavigateToPodcast}
                onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToOrgSummary={onNavigateToOrgSummary}
                onNavigateToVisualControl={onNavigateToVisualControl}
                onNavigateToTeams={onNavigateToTeams}
                onNavigateToSystem={onNavigateToSystem}
                onUpgradeClick={onUpgradeClick}
                onAddTask={onAddTask}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    user={user}
                    onLogout={handleLogout}
                    onNavigateToHome={onNavigateToHome}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToReports={onNavigateToReports}
                    onNavigateToBaseline={onNavigateToBaseline}
                    onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={onNavigateToAnalysis}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToMonitoringControl={onNavigateToMonitoringControl}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={onNavigateToOrgChart}
                    onNavigateToOrgSummary={onNavigateToOrgSummary}
                    onNavigateToVisualControl={onNavigateToVisualControl}
                    onNavigateToTeams={onNavigateToTeams}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="monitoringControl"
                />

                <div className="flex-1 overflow-y-auto p-4 lg:p-6 animate-slide-up">
                    <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Monitoramento e Controle</h1>
                            <p className="text-brand-med-gray text-sm mt-1">Acompanhamento diário Realizado x Previsto</p>
                        </div>
                        
                        <div className="flex items-center gap-4 bg-brand-dark/50 p-2 rounded-lg border border-white/5">
                            <select 
                                value={currentMonth} 
                                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                                className="bg-transparent text-white border-none font-bold outline-none cursor-pointer focus:ring-0"
                            >
                                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                                    <option key={i} value={i} className="bg-brand-dark text-white">{m}</option>
                                ))}
                            </select>
                            <input 
                                type="number" 
                                value={currentYear}
                                onChange={(e) => setCurrentYear(Number(e.target.value))}
                                className="bg-transparent border-none text-white w-20 font-bold outline-none focus:ring-0"
                            />
                        </div>
                    </header>

                    {/* TABS */}
                    <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-thin">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-bold transition-all ${
                                    selectedTab === tab 
                                    ? 'bg-brand-accent text-white shadow-[0_0_15px_rgba(255,107,0,0.4)]' 
                                    : 'bg-brand-dark/40 text-brand-med-gray hover:bg-brand-dark hover:text-white border border-white/5'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* TABLE CONTROLS */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-sm text-brand-med-gray font-semibold bg-brand-dark/30 px-3 py-1.5 rounded border border-white/5 border-l-brand-accent border-l-2">
                            {allRelevantTasks.length} Registros ({selectedTab})
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={addCustomRow}
                                className="flex items-center gap-2 bg-brand-dark/80 text-white text-xs font-bold px-3 py-1.5 rounded border border-white/10 hover:border-brand-accent transition-colors"
                            >
                                + Linha Manual
                            </button>
                            <button 
                                onClick={() => onAddTask && onAddTask()}
                                className="flex items-center gap-2 bg-brand-accent text-white text-xs font-bold px-3 py-1.5 rounded shadow-[0_4px_15px_rgba(255,107,0,0.3)] hover:brightness-110 transition-colors"
                            >
                                + Nova Tarefa Real
                            </button>
                        </div>
                    </div>

                    {isLoadingData ? (
                        <div className="flex justify-center items-center h-64 flex-col text-brand-med-gray">
                            <div className="w-10 h-10 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin mb-4"></div>
                            Importando base histórica de ~4 anos ({allRelevantTasks.length} Registros)...
                        </div>
                    ) : (
                    <div className="bg-[#0a0f18] border border-white/5 rounded-xl shadow-2xl relative overflow-x-auto max-h-[60vh] custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-max text-[11px] font-medium">
                            <thead className="sticky top-0 z-10 bg-[#121824] shadow-md">
                                <tr>
                                    <th className="p-2 border border-white/5 text-gray-300 w-32 tracking-wider">OAE</th>
                                    <th className="p-2 border border-white/5 text-gray-300 w-32 tracking-wider">APOIO</th>
                                    <th className="p-2 border border-white/5 text-gray-300 w-40 tracking-wider">ENGENHEIRO(A)</th>
                                    <th className="p-2 border border-white/5 text-brand-accent w-28 tracking-wider">TIPO/ADICIONAL</th>
                                    <th className="p-2 border border-white/5 text-brand-med-gray w-16 text-center font-bold">P / R</th>
                                    <th className="p-2 border border-white/5 text-white w-20 text-center font-bold bg-white/5">TOTAL P/R</th>
                                    
                                    {daysArray.map(day => (
                                        <th key={day} className="p-2 border border-white/5 text-gray-400 w-12 text-center">
                                            {String(day).padStart(2, '0')}/{String(currentMonth + 1).padStart(2, '0')}
                                        </th>
                                    ))}
                                    <th className="p-2 border border-white/5 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {allRelevantTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={daysInMonth + 6} className="text-center py-12 text-brand-med-gray">
                                            <div className="flex flex-col items-center justify-center opacity-70">
                                                <svg className="w-12 h-12 mb-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Nenhum serviço de "{selectedTab}" encontrado para exibir. <br/> Importe tarefas ou adicione linhas manuais.
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    allRelevantTasks.map((task) => {
                                        const isCustom = task.id.startsWith('custom_row_');

                                        return (
                                            <React.Fragment key={task.id}>
                                                <tr className="bg-[#0c121d] hover:bg-[#111825] transition-colors group">
                                                    <td rowSpan={2} className="p-2 border border-white/5 align-top">
                                                        {isCustom ? (
                                                            <input type="text" value={task.location} onChange={(e) => updateCustomRow(task.id, 'location', e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-brand-accent outline-none text-white text-xs"/>
                                                        ) : (
                                                            <span className="text-white font-semibold">{task.location || '-'}</span>
                                                        )}
                                                        {!isCustom && <div className="text-[9px] text-gray-500 mt-1 truncate max-w-[120px]" title={task.title}>{task.title}</div>}
                                                    </td>
                                                    <td rowSpan={2} className="p-2 border border-white/5 align-top">
                                                        {isCustom ? (
                                                            <input type="text" value={task.support} onChange={(e) => updateCustomRow(task.id, 'support', e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-brand-accent outline-none text-gray-300 text-xs"/>
                                                        ) : (
                                                            <span className="text-gray-300">{task.support || '-'}</span>
                                                        )}
                                                    </td>
                                                    <td rowSpan={2} className="p-2 border border-white/5 align-top">
                                                        {isCustom ? (
                                                            <input type="text" value={task.assignee} onChange={(e) => updateCustomRow(task.id, 'assignee', e.target.value)} className="w-full bg-transparent border-b border-white/20 focus:border-brand-accent outline-none text-gray-400 text-xs"/>
                                                        ) : (
                                                            <span className="text-gray-400">{task.assignee || '-'}</span>
                                                        )}
                                                    </td>
                                                    <td rowSpan={2} className="p-2 border border-white/5 align-top bg-brand-dark/20 text-center">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Ex: Protendida"
                                                            value={dailyData[task.id]?.type || ''} 
                                                            onChange={(e) => handleTypeChange(task.id, e.target.value)} 
                                                            className="w-full bg-transparent border-none text-center focus:outline-none text-brand-accent text-xs font-semibold placeholder-brand-med-gray/30"
                                                        />
                                                    </td>
                                                    
                                                    {/* LINHA PREVISTO */}
                                                    <td className="p-1 border border-white/5 text-center font-bold tracking-widest text-[#4f5b70] bg-[#080d15] text-[10px]">PREV</td>
                                                    <td className="p-2 border border-white/5 text-center font-bold text-[#64748b] bg-[#0c121d]">{calculateTotals(task.id, 'prev')}</td>
                                                    
                                                    {daysArray.map(day => {
                                                        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const val = dailyData[task.id]?.[dateKey]?.prev || '';
                                                        return (
                                                            <td key={`prev-${day}`} className="p-0 border border-white/5 bg-[#0a0f18]">
                                                                <input 
                                                                    type="number" 
                                                                    min="0"
                                                                    value={val}
                                                                    onChange={(e) => handleDataChange(task.id, dateKey, 'prev', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent text-gray-300 border-none outline-none focus:bg-white/5 focus:text-brand-accent"
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                    <td rowSpan={2} className="p-1 border border-white/5 text-center align-middle">
                                                        {isCustom && (
                                                            <button onClick={() => deleteCustomRow(task.id)} className="text-red-500/50 hover:text-red-500 transition-colors" title="Deletar linha">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                
                                                {/* LINHA REALIZADO */}
                                                <tr className="bg-[#121a28] group-hover:bg-[#161f30] transition-colors">
                                                    <td className="p-1 border border-white/5 text-center font-bold tracking-widest text-brand-accent/80 bg-[#0c121e] text-[10px]">REAL</td>
                                                    <td className="p-2 border border-white/5 text-center font-black text-brand-accent bg-[#111825]">{calculateTotals(task.id, 'real')}</td>
                                                    
                                                    {daysArray.map(day => {
                                                        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const val = dailyData[task.id]?.[dateKey]?.real || '';
                                                        return (
                                                            <td key={`real-${day}`} className="p-0 border border-white/5 bg-[#121a28]">
                                                                <input 
                                                                    type="number" 
                                                                    min="0"
                                                                    value={val}
                                                                    onChange={(e) => handleDataChange(task.id, dateKey, 'real', e.target.value)}
                                                                    className="w-full h-8 text-center bg-transparent font-bold text-white border-none outline-none focus:bg-brand-accent/10 focus:text-brand-accent"
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                </div>
            </main>
        </div>
    );
};

export default MonitoringControlPage;
