
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import { LeanTask, LeanSubTask, Worker, MacroDiscipline, AISuggestion } from '../types';
import PlusIcon from './icons/PlusIcon';
import DeleteIcon from './icons/DeleteIcon';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface LeanConstructionPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const LeanConstructionPage: React.FC<LeanConstructionPageProps> = ({
    onNavigateToDashboard, onNavigateToReports, onNavigateToBaseline, onNavigateToCurrentSchedule, onNavigateToAnalysis, onNavigateToLean, onNavigateToLeanConstruction, onUpgradeClick, showToast
}) => {
    const { currentUser: user, signOut, leanTasks, saveLeanTask, deleteLeanTask } = useData();
    const [selectedTask, setSelectedTask] = useState<LeanTask | null>(null);
    const [isMainFormOpen, setIsMainFormOpen] = useState(false);
    const [isSubFormOpen, setIsSubFormOpen] = useState(false);
    const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Form Data
    const [newTask, setNewTask] = useState<Partial<LeanTask>>({
        discipline: 'Terraplenagem', service: '', location: '', date: new Date().toISOString().split('T')[0], quantity: 0, unit: 'un',
        shiftStartTime: '07:00', shiftEndTime: '17:00', lunchStartTime: '12:00', lunchEndTime: '13:00', analysisInterval: 30, subtasks: []
    });

    const [newSubTask, setNewSubTask] = useState<{
        description: string; startTime: string; endTime: string; machinery: number; isUnproductive: boolean; workers: Worker[]; producedQuantity: number; unit: string;
    }>({
        description: '', startTime: '07:00', endTime: '17:00', machinery: 0, isUnproductive: false, workers: [], producedQuantity: 0, unit: 'un'
    });

    const [tempWorkerRole, setTempWorkerRole] = useState<string>('Servente');
    const [tempCustomWorkerRole, setTempCustomWorkerRole] = useState<string>('');
    const [tempWorkerCount, setTempWorkerCount] = useState<number>(1);

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    const calculateTaskMetrics = (task: LeanTask) => {
        let productiveManHours = 0;
        let totalMachineHours = 0;
        let unproductiveManHours = 0;
        const resourceSummary: Record<string, number> = {};

        task.subtasks.forEach(sub => {
            const start = new Date(`2000-01-01T${sub.startTime}`);
            const end = new Date(`2000-01-01T${sub.endTime}`);
            const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

            sub.workers.forEach(w => {
                const mh = hours * w.count;
                const roleName = w.role === 'Outro' && w.customRole ? w.customRole : w.role;
                resourceSummary[roleName] = (resourceSummary[roleName] || 0) + mh;

                if (sub.isUnproductive) {
                    unproductiveManHours += mh;
                } else {
                    productiveManHours += mh;
                }
            });

            if (!sub.isUnproductive) {
                totalMachineHours += hours * (sub.machinery || 0);
            }
        });

        const rup = task.quantity > 0 ? (productiveManHours / task.quantity).toFixed(2) : '0.00';
        const productivity = productiveManHours > 0 ? (task.quantity / productiveManHours).toFixed(2) : '0.00';

        return { productiveManHours, totalMachineHours, unproductiveManHours, rup, productivity, resourceSummary };
    };

    const handleGenerateAISuggestion = async () => {
        if (!selectedTask) return;
        setIsAnalyzing(true);
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const metrics = calculateTaskMetrics(selectedTask);
            const prompt = `
                Atue como 'Hugo', um Engenheiro Sênior especialista em Produtividade e Lean Construction.
                Analise os dados desta atividade de obra e forneça um feedback executivo e direto.

                **Dados da Atividade:**
                - Serviço: ${selectedTask.service}
                - Disciplina: ${selectedTask.discipline}
                - Meta/Quantidade: ${selectedTask.quantity} ${selectedTask.unit}
                - RUP Atual: ${metrics.rup} Hh/${selectedTask.unit}
                - Produtividade Atual: ${metrics.productivity} ${selectedTask.unit}/Hh
                - Horas Produtivas Totais: ${metrics.productiveManHours.toFixed(2)}h
                - Horas Improdutivas/Apoio: ${metrics.unproductiveManHours.toFixed(2)}h

                **Fluxo de Subtarefas:**
                ${selectedTask.subtasks.map(s => `- ${s.startTime} às ${s.endTime}: ${s.description} (${s.workers.map(w => w.count + ' ' + (w.role === 'Outro' ? w.customRole : w.role)).join(', ')}) ${s.isUnproductive ? '[IMPRODUTIVO/APOIO]' : ''}`).join('\n')}

                **Sua Análise deve conter:**
                1. **Diagnóstico Rápido:** Uma frase sobre a eficiência atual.
                2. **Pontos de Atenção:** Identifique desbalanceamento de equipe ou gargalos nos horários.
                3. **Ação Recomendada:** O que o engenheiro deve fazer amanhã para melhorar o RUP?

                Use formatação Markdown com negrito para destaque. Mantenha um tom profissional, técnico mas encorajador.
            `;

            const result = await model.generateContent(prompt);
            const suggestionText = result.response.text();

            const newSuggestion: AISuggestion = {
                date: new Date().toLocaleString('pt-BR'),
                text: suggestionText
            };

            const updatedTask = {
                ...selectedTask,
                aiSuggestions: [newSuggestion, ...(selectedTask.aiSuggestions || [])]
            };

            await saveLeanTask(updatedTask);
            setSelectedTask(updatedTask);
            showToast("Análise do Hugo IA gerada com sucesso!", 'success');

        } catch (error) {
            console.error("Erro AI:", error);
            showToast("Erro ao gerar análise. Verifique sua chave API.", 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAddMainTask = async () => {
        if (!newTask.discipline || !newTask.service || !newTask.location || !newTask.date) {
            showToast("Preencha todos os campos obrigatórios (*)", 'error');
            return;
        }
        const task: LeanTask = {
            id: Date.now().toString(),
            discipline: newTask.discipline as MacroDiscipline,
            service: newTask.service, location: newTask.location, date: newTask.date,
            quantity: Number(newTask.quantity) || 0, unit: newTask.unit || 'un',
            shiftStartTime: newTask.shiftStartTime || '07:00', shiftEndTime: newTask.shiftEndTime || '17:00',
            lunchStartTime: newTask.lunchStartTime || '12:00', lunchEndTime: newTask.lunchEndTime || '13:00',
            analysisInterval: Number(newTask.analysisInterval) || 30,
            subtasks: []
        };

        const { success, error } = await saveLeanTask(task);
        if (success) {
            setNewTask({ ...newTask, service: '', location: '', quantity: 0 });
            setIsMainFormOpen(false);
            showToast("Atividade criada.", 'success');
        } else {
            showToast(`Erro ao criar atividade: ${error}`, 'error');
        }
    };

    const addWorkerToSubTask = () => {
        if (tempWorkerCount <= 0) return;
        if (tempWorkerRole === 'Outro' && !tempCustomWorkerRole) {
            showToast("Digite o nome da função para 'Outro'.", 'error');
            return;
        }

        const roleKey = tempWorkerRole;
        const customRole = tempWorkerRole === 'Outro' ? tempCustomWorkerRole : undefined;

        // Check if role already exists in current list to merge counts if same role name
        const existingIndex = newSubTask.workers.findIndex(w => w.role === roleKey && w.customRole === customRole);

        let updatedWorkers;
        if (existingIndex >= 0) {
            updatedWorkers = [...newSubTask.workers];
            updatedWorkers[existingIndex].count += tempWorkerCount;
        } else {
            updatedWorkers = [...newSubTask.workers, { role: roleKey, customRole: customRole, count: tempWorkerCount }];
        }

        setNewSubTask({ ...newSubTask, workers: updatedWorkers });
        setTempWorkerCount(1);
        setTempCustomWorkerRole('');
        if (tempWorkerRole === 'Outro') setTempWorkerRole('Servente'); // Reset to default
    };

    const removeWorkerFromSubTask = (idx: number) => {
        setNewSubTask({ ...newSubTask, workers: newSubTask.workers.filter((_, i) => i !== idx) });
    };

    const handleSaveSubTask = async () => {
        if (!selectedTask) return;
        if (!newSubTask.description || !newSubTask.startTime || !newSubTask.endTime) {
            showToast("Preencha descrição e horários.", 'error');
            return;
        }

        const subData = {
            description: newSubTask.description,
            startTime: newSubTask.startTime,
            endTime: newSubTask.endTime,
            workers: newSubTask.workers,
            machinery: Number(newSubTask.machinery) || 0,
            isUnproductive: newSubTask.isUnproductive,
            producedQuantity: Number(newSubTask.producedQuantity) || 0,
            unit: newSubTask.unit || 'un'
        };

        let updatedTask: LeanTask;
        if (editingSubTaskId) {
            updatedTask = {
                ...selectedTask,
                subtasks: selectedTask.subtasks.map(s => s.id === editingSubTaskId ? { ...s, ...subData } : s)
            };
        } else {
            updatedTask = {
                ...selectedTask,
                subtasks: [...selectedTask.subtasks, { id: Date.now().toString(), ...subData }]
            };
        }

        const { success, error } = await saveLeanTask(updatedTask);
        if (success) {
            setSelectedTask(updatedTask);
            handleCancelSubTaskForm();
        } else {
            showToast(`Erro ao salvar etapa: ${error}`, 'error');
        }
    };

    const handleEditSubTaskClick = (sub: LeanSubTask) => {
        setNewSubTask({
            ...sub,
            producedQuantity: sub.producedQuantity || 0,
            unit: sub.unit || 'un'
        });
        setEditingSubTaskId(sub.id);
        setIsSubFormOpen(true);
    };

    const handleCancelSubTaskForm = () => {
        setIsSubFormOpen(false);
        setEditingSubTaskId(null);
        setNewSubTask({ description: '', startTime: '07:00', endTime: '17:00', machinery: 0, isUnproductive: false, workers: [], producedQuantity: 0, unit: 'un' });
    };

    const handleDeleteSubTask = async (subId: string) => {
        if (!selectedTask) return;
        const updatedTask = { ...selectedTask, subtasks: selectedTask.subtasks.filter(s => s.id !== subId) };

        const { success, error } = await saveLeanTask(updatedTask);
        if (success) {
            setSelectedTask(updatedTask);
            if (editingSubTaskId === subId) handleCancelSubTaskForm();
        } else {
            showToast(`Erro ao excluir etapa: ${error}`, 'error');
        }
    };

    const handleDeleteMainTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Tem certeza que deseja excluir esta atividade?")) {
            const { success, error } = await deleteLeanTask(id);
            if (success) {
                if (selectedTask?.id === id) setSelectedTask(null);
                showToast("Atividade excluída.", 'success');
            } else {
                showToast(`Erro ao excluir: ${error}`, 'error');
            }
        }
    };

    const handleUpdateTaskSettings = async (updates: Partial<LeanTask>) => {
        if (!selectedTask) return;
        const updatedTask = { ...selectedTask, ...updates };
        const { success, error } = await saveLeanTask(updatedTask);
        if (success) {
            setSelectedTask(updatedTask);
        } else {
            showToast(`Erro ao atualizar: ${error}`, 'error');
        }
    }

    const flowAnalysis = useMemo(() => {
        if (!selectedTask || selectedTask.subtasks.length === 0) return [];
        const subs = [...selectedTask.subtasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const rawAnalysis: { start: number, end: number, status: string, msg: string, type: 'bad' | 'good' | 'neutral' | 'warn' }[] = [];
        const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

        const shiftStart = toMins(selectedTask.shiftStartTime);
        const shiftEnd = toMins(selectedTask.shiftEndTime);
        const lunchStart = toMins(selectedTask.lunchStartTime);
        const lunchEnd = toMins(selectedTask.lunchEndTime);
        const interval = selectedTask.analysisInterval || 30;

        let currentBlock: { start: number, end: number, status: string, msg: string, type: 'bad' | 'good' | 'neutral' | 'warn' } | null = null;

        for (let t = shiftStart; t < shiftEnd; t += interval) {
            const mid = t + interval / 2;
            let status = '';
            let msg = '';
            let type: 'bad' | 'good' | 'neutral' | 'warn' = 'neutral';

            if (mid >= lunchStart && mid < lunchEnd) {
                status = 'Almoço';
                msg = 'Intervalo programado';
                type = 'neutral';
            } else {
                const active = subs.filter(s => toMins(s.startTime) < (t + interval) && toMins(s.endTime) > t);
                if (active.length === 0) {
                    status = 'Ocioso';
                    msg = 'Parada não planejada';
                    type = 'bad';
                } else {
                    if (active.every(s => s.isUnproductive)) {
                        status = 'Improdutivo';
                        msg = `Atividade Auxiliar: ${active.map(a => a.description).join(' + ')}`;
                        type = 'warn';
                    } else if (active.filter(s => !s.isUnproductive).length > 1) {
                        status = 'Gargalo';
                        msg = `Conflito: ${active.filter(s => !s.isUnproductive).map(a => a.description).join(' + ')}`;
                        type = 'bad';
                    }
                }
            }

            if (status) {
                if (currentBlock && currentBlock.status === status && currentBlock.msg === msg) {
                    currentBlock.end = t + interval;
                } else {
                    if (currentBlock) rawAnalysis.push(currentBlock);
                    currentBlock = { start: t, end: t + interval, status, msg, type };
                }
            } else {
                if (currentBlock) {
                    rawAnalysis.push(currentBlock);
                    currentBlock = null;
                }
            }
        }
        if (currentBlock) rawAnalysis.push(currentBlock);

        return rawAnalysis.map(item => ({
            time: `${fmtTime(item.start)} - ${fmtTime(item.end)}`,
            status: item.status,
            msg: item.msg,
            type: item.type
        }));
    }, [selectedTask]);

    function fmtTime(m: number) { return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`; }

    if (!user) return null;

    return (
        <div className="flex flex-col h-screen bg-[#060a12] text-gray-100 overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
            <Header user={user} onLogout={handleLogout} onNavigateToDashboard={onNavigateToDashboard} onNavigateToReports={onNavigateToReports} onNavigateToBaseline={onNavigateToBaseline} onNavigateToCurrentSchedule={onNavigateToCurrentSchedule} onNavigateToAnalysis={onNavigateToAnalysis} onNavigateToLean={onNavigateToLean} onNavigateToLeanConstruction={onNavigateToLeanConstruction} onUpgradeClick={onUpgradeClick} activeScreen="leanConstruction" />

            <main className="flex-1 overflow-y-auto p-4 md:p-8 animate-fade-in relative text-sm">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none"></div>
                <div className="max-w-7xl mx-auto relative z-10">

                    {!selectedTask && (
                        <div className="mb-8 flex items-center gap-4">
                            <button onClick={onNavigateToDashboard} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all border border-white/5"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                            <div className="flex-1">
                                <h1 className="text-3xl font-black text-white tracking-widest uppercase mb-1">Lean <span className="text-cyan-400">Analytics</span></h1>
                                <p className="text-xs text-gray-400 uppercase tracking-widest">Controle de Fluxo & RUP</p>
                            </div>
                        </div>
                    )}

                    {!selectedTask ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                <p className="text-gray-400 text-sm">Gerencie suas atividades.</p>
                                {user.role !== 'Gerenciador' && (
                                    <button onClick={() => setIsMainFormOpen(!isMainFormOpen)} className="bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2"><PlusIcon className="w-4 h-4" /> {isMainFormOpen ? 'Fechar' : 'Nova Atividade'}</button>
                                )}
                            </div>

                            {isMainFormOpen && (
                                <div className="bg-[#111827] rounded-xl p-6 border border-cyan-500/30 shadow-2xl mb-6">
                                    <h3 className="font-bold text-white mb-4"><PlusIcon className="w-4 h-4 text-cyan-400 inline mr-2" /> Nova Atividade</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                        <div className="col-span-1"><label className="text-[10px] uppercase font-bold text-gray-500">Disciplina</label><select className="w-full bg-[#0a0f18] border border-white/10 rounded-lg p-2 text-white" value={newTask.discipline} onChange={e => setNewTask({ ...newTask, discipline: e.target.value as MacroDiscipline })}><option>Terraplenagem</option><option>Drenagem</option><option>Obra de Arte Especial</option><option>Fabricação</option><option>Contenções</option></select></div>
                                        <div className="col-span-2"><label className="text-[10px] uppercase font-bold text-gray-500">Serviço</label><input type="text" className="w-full bg-[#0a0f18] border border-white/10 rounded-lg p-2 text-white" value={newTask.service} onChange={e => setNewTask({ ...newTask, service: e.target.value })} placeholder="Ex: Concretagem" /></div>
                                        <div className="col-span-1"><label className="text-[10px] uppercase font-bold text-gray-500">Local</label><input type="text" className="w-full bg-[#0a0f18] border border-white/10 rounded-lg p-2 text-white" value={newTask.location} onChange={e => setNewTask({ ...newTask, location: e.target.value })} /></div>
                                        <div className="col-span-1"><label className="text-[10px] uppercase font-bold text-gray-500">Meta / Un</label><div className="flex gap-2"><input type="number" className="w-2/3 bg-[#0a0f18] border border-white/10 rounded-lg p-2 text-white" value={newTask.quantity} onChange={e => setNewTask({ ...newTask, quantity: Number(e.target.value) })} /><input type="text" className="w-1/3 bg-[#0a0f18] border border-white/10 rounded-lg p-2 text-white text-center" value={newTask.unit} onChange={e => setNewTask({ ...newTask, unit: e.target.value })} /></div></div>
                                    </div>
                                    <button onClick={handleAddMainTask} className="w-full py-2 bg-cyan-500 rounded-lg text-white font-bold">Salvar</button>
                                </div>
                            )}

                            {leanTasks.map(task => {
                                const metrics = calculateTaskMetrics(task);
                                return (
                                    <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-[#111827]/50 border border-white/5 p-5 rounded-2xl hover:border-cyan-500/30 cursor-pointer flex justify-between items-center transition-all group relative pr-12">
                                        {user.role !== 'Gerenciador' && (
                                            <button onClick={(e) => handleDeleteMainTask(task.id, e)} className="absolute top-1/2 -translate-y-1/2 right-4 p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-[#060a12] rounded-full shadow-lg border border-white/10"><DeleteIcon className="w-5 h-5" /></button>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-white text-lg group-hover:text-cyan-400">{task.service}</h3>
                                            <p className="text-gray-500 text-xs">{task.discipline} • {task.location}</p>
                                        </div>
                                        <div className="flex gap-6 text-center">
                                            <div><span className="block font-bold text-cyan-400 text-xl">{metrics.rup} <span className="text-[10px] text-gray-500 font-normal">Hh/{task.unit}</span></span><span className="text-[9px] uppercase text-gray-500">RUP</span></div>
                                            <div><span className="block font-bold text-green-400 text-xl">{metrics.productivity} <span className="text-[10px] text-gray-500 font-normal">{task.unit}/Hh</span></span><span className="text-[9px] uppercase text-gray-500">Produt.</span></div>
                                            <div><span className="block font-bold text-white text-xl">{task.subtasks.length}</span><span className="text-[9px] uppercase text-gray-500">Etapas</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="animate-slide-up">
                            <div className="flex flex-col md:flex-row gap-4 mb-6 border-b border-white/5 pb-6 items-start md:items-center">
                                <button onClick={handleEditSubTaskClick} className="hidden"></button>
                                <button onClick={() => setSelectedTask(null)} className="p-2 bg-white/5 rounded-lg text-white hover:bg-white/10"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedTask.service}</h2>
                                    <div className="flex flex-wrap gap-4 mt-2">
                                        <div className="bg-white/5 px-3 py-1 rounded text-xs text-gray-300">Turno: <input type="time" disabled={user.role === 'Gerenciador'} className="bg-transparent w-16 text-center outline-none text-cyan-400 disabled:opacity-50" value={selectedTask.shiftStartTime} onChange={e => handleUpdateTaskSettings({ shiftStartTime: e.target.value })} /> - <input type="time" disabled={user.role === 'Gerenciador'} className="bg-transparent w-16 text-center outline-none text-cyan-400 disabled:opacity-50" value={selectedTask.shiftEndTime} onChange={e => handleUpdateTaskSettings({ shiftEndTime: e.target.value })} /></div>
                                        <div className="bg-white/5 px-3 py-1 rounded text-xs text-gray-300">Almoço: <input type="time" disabled={user.role === 'Gerenciador'} className="bg-transparent w-16 text-center outline-none text-yellow-400 disabled:opacity-50" value={selectedTask.lunchStartTime} onChange={e => handleUpdateTaskSettings({ lunchStartTime: e.target.value })} /> - <input type="time" disabled={user.role === 'Gerenciador'} className="bg-transparent w-16 text-center outline-none text-yellow-400 disabled:opacity-50" value={selectedTask.lunchEndTime} onChange={e => handleUpdateTaskSettings({ lunchEndTime: e.target.value })} /></div>
                                    </div>
                                </div>
                                <div className="ml-auto flex gap-4">
                                    <div className="bg-[#111827] px-4 py-2 rounded-lg border border-cyan-500/20 text-center">
                                        <span className="text-[10px] text-gray-500 uppercase block font-bold">RUP</span>
                                        <span className="text-xl font-bold text-cyan-400">{calculateTaskMetrics(selectedTask).rup} <span className="text-xs text-gray-600">Hh/{selectedTask.unit}</span></span>
                                    </div>
                                    <div className="bg-[#111827] px-4 py-2 rounded-lg border border-green-500/20 text-center">
                                        <span className="text-[10px] text-gray-500 uppercase block font-bold">Produtividade</span>
                                        <span className="text-xl font-bold text-green-400">{calculateTaskMetrics(selectedTask).productivity} <span className="text-xs text-gray-600">{selectedTask.unit}/Hh</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-[#111827] rounded-2xl border border-white/10 p-6 min-h-[500px]">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-bold text-white">Fluxo de Subtarefas</h3>
                                            {user.role !== 'Gerenciador' && (
                                                <button onClick={() => { if (isSubFormOpen) handleCancelSubTaskForm(); else { setEditingSubTaskId(null); setIsSubFormOpen(true); } }} className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">{isSubFormOpen ? 'Cancelar' : '+ Adicionar Etapa'}</button>
                                            )}
                                        </div>

                                        {isSubFormOpen && (
                                            <div className="mb-8 bg-[#0a0f18] p-5 rounded-xl border border-cyan-500/30">
                                                <div className="mb-4"><label className="flex items-center gap-2 text-xs font-bold text-gray-400 cursor-pointer"><input type="checkbox" checked={newSubTask.isUnproductive} onChange={e => setNewSubTask({ ...newSubTask, isUnproductive: e.target.checked })} className="rounded bg-gray-700 border-gray-600 text-yellow-500" /> Atividade Improdutiva</label></div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                                    <div className="col-span-1"><label className="text-[10px] text-gray-500 font-bold uppercase">Descrição</label><input type="text" className="w-full bg-[#111827] border border-white/10 rounded text-white p-2 text-sm" value={newSubTask.description} onChange={e => setNewSubTask({ ...newSubTask, description: e.target.value })} placeholder="Ex: Armação" /></div>
                                                    <div className="col-span-1"><label className="text-[10px] text-gray-500 font-bold uppercase">Início</label><input type="time" className="w-full bg-[#111827] border border-white/10 rounded text-white p-2 text-sm" value={newSubTask.startTime} onChange={e => setNewSubTask({ ...newSubTask, startTime: e.target.value })} /></div>
                                                    <div className="col-span-1"><label className="text-[10px] text-gray-500 font-bold uppercase">Fim</label><input type="time" className="w-full bg-[#111827] border border-white/10 rounded text-white p-2 text-sm" value={newSubTask.endTime} onChange={e => setNewSubTask({ ...newSubTask, endTime: e.target.value })} /></div>
                                                    <div className="col-span-1"><label className="text-[10px] text-gray-500 font-bold uppercase">Qtd. Produzida</label><input type="number" className="w-full bg-[#111827] border border-white/10 rounded text-white p-2 text-sm" value={newSubTask.producedQuantity} onChange={e => setNewSubTask({ ...newSubTask, producedQuantity: Number(e.target.value) })} /></div>
                                                    <div className="col-span-1"><label className="text-[10px] text-gray-500 font-bold uppercase">Unidade</label><input type="text" className="w-full bg-[#111827] border border-white/10 rounded text-white p-2 text-sm" value={newSubTask.unit} onChange={e => setNewSubTask({ ...newSubTask, unit: e.target.value })} /></div>
                                                </div>

                                                <div className="mb-4 bg-[#111827]/50 p-3 rounded border border-white/5">
                                                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block">Colaboradores & Recursos</label>
                                                    <div className="flex gap-2 mb-3">
                                                        <select className="bg-[#0a0f18] border border-white/10 rounded text-white text-xs p-2 flex-1" value={tempWorkerRole} onChange={e => setTempWorkerRole(e.target.value)}>
                                                            <option>Servente</option><option>Pedreiro</option><option>Carpinteiro</option><option>Armador</option><option>Encarregado</option><option>Soldador</option><option>Operador</option><option>Motorista</option><option>Outro</option>
                                                        </select>
                                                        {tempWorkerRole === 'Outro' && (
                                                            <input type="text" className="bg-[#0a0f18] border border-white/10 rounded text-white text-xs p-2 flex-1" placeholder="Qual função?" value={tempCustomWorkerRole} onChange={e => setTempCustomWorkerRole(e.target.value)} />
                                                        )}
                                                        <input type="number" className="bg-[#0a0f18] border border-white/10 rounded text-white text-xs p-2 w-20" min="1" value={tempWorkerCount} onChange={e => setTempWorkerCount(Number(e.target.value))} />
                                                        <button onClick={addWorkerToSubTask} className="bg-cyan-500/20 text-cyan-400 px-3 rounded font-bold hover:bg-cyan-500 hover:text-white transition">+</button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {newSubTask.workers.map((w, idx) => (
                                                            <span key={idx} className="bg-white/5 px-2 py-1 rounded text-xs text-gray-300 flex items-center gap-2 border border-white/10">
                                                                {w.count}x {w.role === 'Outro' ? w.customRole : w.role} <button onClick={() => removeWorkerFromSubTask(idx)} className="text-red-400 hover:text-red-300">×</button>
                                                            </span>
                                                        ))}
                                                        {newSubTask.workers.length === 0 && <span className="text-xs text-gray-600 italic">Nenhum colaborador adicionado.</span>}
                                                    </div>
                                                    <div className="mt-3"><label className="text-[10px] text-gray-500 font-bold uppercase mr-2">Máquinas:</label><input type="number" className="bg-[#0a0f18] border border-white/10 rounded text-white text-xs p-1 w-16" value={newSubTask.machinery} onChange={e => setNewSubTask({ ...newSubTask, machinery: Number(e.target.value) })} /></div>
                                                </div>

                                                <button onClick={handleSaveSubTask} className="w-full py-2 bg-cyan-500 rounded text-white font-bold text-sm">Salvar Etapa</button>
                                            </div>
                                        )}

                                        <div className="space-y-3 mb-6">
                                            {selectedTask.subtasks.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((sub) => (
                                                <div key={sub.id} className={`p-4 rounded-xl border flex justify-between items-center group relative ${sub.isUnproductive ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-[#0a0f18] border-white/5 hover:border-cyan-500/30'}`}>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${sub.isUnproductive ? 'text-yellow-400 border-yellow-500/20' : 'text-cyan-400 border-cyan-500/20'}`}>{sub.startTime} - {sub.endTime}</span>
                                                            <span className="text-white font-bold text-sm">{sub.description}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                                                            {sub.workers.map((w, i) => <span key={i} className="bg-white/5 px-1.5 rounded">{w.count} {w.role === 'Outro' ? w.customRole : w.role}</span>)}
                                                            {sub.machinery > 0 && <span className="text-cyan-400">{sub.machinery} Máq.</span>}
                                                            {sub.producedQuantity && sub.producedQuantity > 0 && <span className="text-green-400 font-bold border border-green-500/30 px-1.5 rounded">{sub.producedQuantity} {sub.unit}</span>}
                                                        </div>
                                                    </div>
                                                    {user.role !== 'Gerenciador' && (
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleEditSubTaskClick(sub)} className="p-2 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                                            <button onClick={() => handleDeleteSubTask(sub.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"><DeleteIcon className="w-4 h-4" /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI Suggestion Section */}
                                    <div className="bg-gradient-to-r from-purple-900/10 to-[#111827] rounded-2xl border border-purple-500/20 p-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg>
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-6">
                                                <div>
                                                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                                                        <span className="bg-purple-500/20 p-1.5 rounded-lg"><span className="text-purple-400 text-lg">✦</span></span>
                                                        Hugo IA
                                                    </h3>
                                                    <p className="text-xs text-gray-400">Análise inteligente de produtividade e engenharia.</p>
                                                </div>
                                                <button onClick={handleGenerateAISuggestion} disabled={isAnalyzing} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-900/20 transition-all font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95">
                                                    {isAnalyzing ? (
                                                        <> <span className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"></span> Processando... </>
                                                    ) : (
                                                        <> <span>⚡</span> Gerar Nova Análise </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                                {selectedTask.aiSuggestions && selectedTask.aiSuggestions.length > 0 ? (
                                                    selectedTask.aiSuggestions.map((sug, idx) => (
                                                        <div key={idx} className="bg-[#0a0f18]/80 p-5 rounded-xl border border-purple-500/10 hover:border-purple-500/30 transition-colors shadow-sm">
                                                            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Relatório Gerado</span>
                                                                <span className="text-[10px] text-gray-500 font-mono">{sug.date}</span>
                                                            </div>
                                                            <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed font-light">
                                                                <div dangerouslySetInnerHTML={{ __html: sug.text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>').replace(/^\s*-\s/gm, '• ') }} />
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="bg-[#0a0f18]/50 rounded-xl p-8 text-center border border-white/5 border-dashed">
                                                        <p className="text-gray-500 text-sm mb-2">O histórico de análises está vazio.</p>
                                                        <p className="text-xs text-gray-600">Peça para o Hugo IA analisar os dados de produtividade acima.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-[#111827] rounded-2xl p-6 border border-white/10 shadow-xl flex flex-col">
                                        <h3 className="text-lg font-bold text-white mb-4 border-b border-white/5 pb-4"><span className="text-red-400 mr-2">🚨</span> Monitor</h3>
                                        <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-2 custom-scrollbar">
                                            {flowAnalysis.map((item, i) => (
                                                <div key={i} className={`p-2 rounded border text-xs ${item.type === 'bad' ? 'bg-red-500/10 border-red-500/20 text-red-300' : item.type === 'neutral' ? 'bg-blue-500/5 border-blue-500/10 text-blue-300' : item.type === 'warn' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200' : 'bg-gray-800'}`}>
                                                    <div className="flex justify-between font-bold mb-1"><span>{item.status}</span><span className="font-mono opacity-50">{item.time}</span></div>
                                                    {item.msg}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-white/5">
                                            <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2">Resumo de Colaboradores</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {Object.entries(calculateTaskMetrics(selectedTask).resourceSummary).map(([role, hours]) => (
                                                    <div key={role} className="flex justify-between bg-white/5 p-2 rounded border border-white/5">
                                                        <span className="text-gray-300">{role}</span>
                                                        <span className="font-mono text-cyan-400 font-bold">{(hours).toFixed(1)}h</span>
                                                    </div>
                                                ))}
                                                {Object.keys(calculateTaskMetrics(selectedTask).resourceSummary).length === 0 && <span className="text-gray-600 col-span-2 text-center text-[10px]">Sem dados.</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default LeanConstructionPage;
