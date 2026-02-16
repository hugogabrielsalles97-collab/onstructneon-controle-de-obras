
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import Sidebar from './Sidebar';
import { LeanTask, LeanSubTask, Worker, MacroDiscipline, AISuggestion } from '../types';
import PlusIcon from './icons/PlusIcon';
import DeleteIcon from './icons/DeleteIcon';
import XIcon from './icons/XIcon';
import ConstructionIcon from './icons/ConstructionIcon';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ConfirmModal from './ConfirmModal';

interface LeanConstructionPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToCost: () => void;
    onNavigateToHome?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const LeanConstructionPage: React.FC<LeanConstructionPageProps> = ({
    onNavigateToDashboard, onNavigateToReports, onNavigateToBaseline, onNavigateToCurrentSchedule, onNavigateToAnalysis, onNavigateToLean, onNavigateToLeanConstruction, onNavigateToWarRoom, onNavigateToPodcast, onNavigateToCost, onNavigateToHome, onUpgradeClick, showToast
}) => {
    const { currentUser: user, signOut, leanTasks, saveLeanTask, deleteLeanTask } = useData();
    const [selectedTask, setSelectedTask] = useState<LeanTask | null>(null);
    const [isMainFormOpen, setIsMainFormOpen] = useState(false);
    const [isSubFormOpen, setIsSubFormOpen] = useState(false);
    const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; type: 'task' | 'subtask' | null }>({ isOpen: false, id: '', type: null });
    const [isDeleting, setIsDeleting] = useState(false);

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
        let totalProduced = 0;
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

            totalProduced += (sub.producedQuantity || 0);
        });

        // RUP = Hh / Unidade Produzida
        const rup = totalProduced > 0 ? (productiveManHours / totalProduced).toFixed(2) : '0.00';

        // Produtividade = Unidade Produzida / Hh
        const productivity = productiveManHours > 0 ? (totalProduced / productiveManHours).toFixed(2) : '0.00';

        return { productiveManHours, totalMachineHours, unproductiveManHours, rup, productivity, resourceSummary, totalProduced };
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
                - Meta Planejada: ${selectedTask.quantity} ${selectedTask.unit}
                - Produção Realizada: ${metrics.totalProduced} ${selectedTask.unit}
                - RUP Real: ${metrics.rup} Hh/${selectedTask.unit}
                - Produtividade Real: ${metrics.productivity} ${selectedTask.unit}/Hh
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

    const handleDeleteSubTask = (subId: string) => {
        setDeleteConfirm({ isOpen: true, id: subId, type: 'subtask' });
    };

    const handleDeleteMainTask = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirm({ isOpen: true, id, type: 'task' });
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm.type || !deleteConfirm.id) return;
        setIsDeleting(true);

        if (deleteConfirm.type === 'task') {
            const { success, error } = await deleteLeanTask(deleteConfirm.id);
            if (success) {
                if (selectedTask?.id === deleteConfirm.id) setSelectedTask(null);
                showToast("Atividade excluída.", 'success');
            } else {
                showToast(`Erro ao excluir: ${error}`, 'error');
            }
        } else if (deleteConfirm.type === 'subtask') {
            if (selectedTask) {
                const updatedTask = { ...selectedTask, subtasks: selectedTask.subtasks.filter(s => s.id !== deleteConfirm.id) };
                const { success, error } = await saveLeanTask(updatedTask);
                if (success) {
                    setSelectedTask(updatedTask);
                    if (editingSubTaskId === deleteConfirm.id) handleCancelSubTaskForm();
                    showToast("Etapa excluída.", 'success');
                } else {
                    showToast(`Erro ao excluir etapa: ${error}`, 'error');
                }
            }
        }

        setIsDeleting(false);
        setDeleteConfirm({ isOpen: false, id: '', type: null });
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
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="leanConstruction"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={() => { }}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToPodcast={onNavigateToPodcast}
                onUpgradeClick={onUpgradeClick}
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
                    onNavigateToLeanConstruction={() => { }}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="leanConstruction"
                />

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 animate-slide-up animate-stagger-2">
                    <div className="max-w-screen-2xl mx-auto space-y-8">

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
                                        <div className="bg-[#0a0f18]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative w-full">
                                            {/* Header */}
                                            <div className="relative px-6 py-4 flex justify-between items-center border-b border-white/5 bg-gradient-to-r from-orange-500/10 via-transparent to-transparent">
                                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className="relative">
                                                        <div className="absolute inset-0 bg-orange-500 rounded-full blur-md opacity-20 animate-pulse"></div>
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1f2937] to-[#111827] flex items-center justify-center border border-white/10 shadow-inner">
                                                            <span className="text-orange-500 text-lg">✦</span>
                                                        </div>
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0a0f18] rounded-full"></div>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-bold text-white leading-tight tracking-wide">Hugo AI</h3>
                                                        <p className="text-[10px] text-orange-500/80 font-mono tracking-wider uppercase flex items-center gap-1">
                                                            <span className="w-1 h-1 bg-orange-500 rounded-full animate-blink"></span>
                                                            Engenheiro Virtual
                                                        </p>
                                                    </div>
                                                </div>
                                                <button onClick={handleGenerateAISuggestion} disabled={isAnalyzing} className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-900/20 transition-all font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95 group">
                                                    {isAnalyzing ? (
                                                        <> <span className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"></span> Analyzing... </>
                                                    ) : (
                                                        <> <span>⚡</span> Nova Análise </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Content */}
                                            <div className="p-6 space-y-5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                                {selectedTask.aiSuggestions && selectedTask.aiSuggestions.length > 0 ? (
                                                    selectedTask.aiSuggestions.map((sug, idx) => (
                                                        <div key={idx} className="flex flex-col gap-2 animate-fade-in group">
                                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                                <div className="w-6 h-6 rounded-full bg-[#1f2937] flex items-center justify-center border border-white/5 shadow-sm">
                                                                    <span className="text-[10px] font-bold text-orange-500">H</span>
                                                                </div>
                                                                <span className="text-[10px] text-gray-500 font-mono">{sug.date}</span>
                                                            </div>
                                                            <div className="bg-[#1f2937]/80 border border-white/5 text-gray-200 rounded-2xl rounded-tl-sm p-5 text-sm shadow-sm backdrop-blur-sm group-hover:border-orange-500/20 transition-colors">
                                                                <div className="leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sug.text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>').replace(/^\s*-\s/gm, '• ') }} />
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
                                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                                            <span className="text-2xl grayscale">🤖</span>
                                                        </div>
                                                        <p className="text-gray-400 text-sm font-medium">O histórico de análises está vazio.</p>
                                                        <p className="text-xs text-gray-600 mt-1">Peça para o Hugo IA analisar os dados de produtividade acima.</p>
                                                    </div>
                                                )}
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
                </div>
                <ConfirmModal
                    isOpen={deleteConfirm.isOpen}
                    onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                    onConfirm={handleConfirmDelete}
                    title={deleteConfirm.type === 'task' ? "Excluir Atividade" : "Excluir Etapa"}
                    message={deleteConfirm.type === 'task'
                        ? "Tem certeza que deseja excluir esta atividade e todas as suas etapas? Esta ação não pode ser desfeita."
                        : "Tem certeza que deseja excluir esta etapa? O impacto no RUP será recalculado."}
                    confirmText="Sim, Excluir"
                    cancelText="Cancelar"
                    type="danger"
                    isLoading={isDeleting}
                />
            </main >

            {/* Modal: Nova Atividade (Main Task) */}
            {
                isMainFormOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsMainFormOpen(false)}>
                        <div className="bg-[#0a0f18]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-[0_0_100px_-20px_rgba(34,211,238,0.3)] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-8 pb-4 flex justify-between items-center border-b border-white/5 bg-gradient-to-r from-cyan-500/5 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 rotate-3 transition-transform hover:rotate-0">
                                        <ConstructionIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic truncate">Nova <span className="text-cyan-400">Atividade</span></h2>
                                        <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mt-0.5">Módulo Lean Analytics</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsMainFormOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-med-gray hover:text-white transition-all border border-white/10 shrink-0"><XIcon className="w-5 h-5" /></button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 pt-6 space-y-8 custom-scrollbar">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-1.5 h-6 bg-cyan-500 rounded-full animate-pulse"></div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Configurações Gerais</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Disciplina</label>
                                            <select
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold appearance-none"
                                                value={newTask.discipline}
                                                onChange={e => setNewTask({ ...newTask, discipline: e.target.value as MacroDiscipline })}
                                            >
                                                <option>Terraplenagem</option>
                                                <option>Drenagem</option>
                                                <option>Obra de Arte Especial</option>
                                                <option>Fabricação</option>
                                                <option>Contenções</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Local / Trecho</label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold placeholder:text-gray-600"
                                                value={newTask.location}
                                                onChange={e => setNewTask({ ...newTask, location: e.target.value })}
                                                placeholder="Ex: Trecho A"
                                            />
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Serviço / Atividade</label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold placeholder:text-gray-600"
                                                value={newTask.service}
                                                onChange={e => setNewTask({ ...newTask, service: e.target.value })}
                                                placeholder="Ex: Concretagem de Laje"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Meta Quantitativa</label>
                                            <input
                                                type="number"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold"
                                                value={newTask.quantity}
                                                onChange={e => setNewTask({ ...newTask, quantity: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Unidade</label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold placeholder:text-gray-600"
                                                value={newTask.unit}
                                                onChange={e => setNewTask({ ...newTask, unit: e.target.value })}
                                                placeholder="Ex: m3"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-8 border-t border-white/5 bg-black/20 flex gap-4">
                                <button onClick={() => setIsMainFormOpen(false)} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all active:scale-95">Cancelar</button>
                                <button onClick={handleAddMainTask} className="flex-[2] py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-cyan-500/20 transition-all transform hover:-translate-y-1 active:scale-95">Salvar Atividade</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal: Nova Etapa (Sub Task) */}
            {
                isSubFormOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleCancelSubTaskForm}>
                        <div className="bg-[#0a0f18]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-[0_0_100px_-20px_rgba(34,211,238,0.3)] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-8 pb-4 flex justify-between items-center border-b border-white/5 bg-gradient-to-r from-cyan-500/5 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 rotate-3 transition-transform hover:rotate-0">
                                        <PlusIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic truncate">{editingSubTaskId ? 'Editar' : 'Nova'} <span className="text-cyan-400">Etapa</span></h2>
                                        <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mt-0.5 italic truncate">Atividade: {selectedTask?.service}</p>
                                    </div>
                                </div>
                                <button onClick={handleCancelSubTaskForm} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-med-gray hover:text-white transition-all border border-white/10 shrink-0"><XIcon className="w-5 h-5" /></button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 pt-6 space-y-10 custom-scrollbar">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-cyan-500 rounded-full animate-pulse"></div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Informações da Etapa</h3>
                                        </div>
                                        <label className="flex items-center gap-3 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl cursor-pointer group transition-all hover:bg-yellow-500/20">
                                            <input
                                                type="checkbox"
                                                checked={newSubTask.isUnproductive}
                                                onChange={e => setNewSubTask({ ...newSubTask, isUnproductive: e.target.checked })}
                                                className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-0 focus:ring-offset-0"
                                            />
                                            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Improdutivo / Apoio</span>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-5">
                                        <div className="md:col-span-4 lg:col-span-8 space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Descrição do Trabalho</label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold placeholder:text-gray-600"
                                                value={newSubTask.description}
                                                onChange={e => setNewSubTask({ ...newSubTask, description: e.target.value })}
                                                placeholder="Ex: Montagem de fôrmas"
                                            />
                                        </div>
                                        <div className="md:col-span-2 lg:col-span-4 space-y-2">
                                            <label className="text-[9px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Volume Realizado</label>
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="number"
                                                    className="flex-1 min-w-0 bg-[#111827]/40 border border-white/10 rounded-xl py-3 px-3 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold"
                                                    value={newSubTask.producedQuantity}
                                                    onChange={e => setNewSubTask({ ...newSubTask, producedQuantity: Number(e.target.value) })}
                                                />
                                                <input
                                                    type="text"
                                                    className="w-16 flex-shrink-0 bg-[#111827]/40 border border-white/10 rounded-xl py-3 text-center text-xs text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold"
                                                    value={newSubTask.unit}
                                                    onChange={e => setNewSubTask({ ...newSubTask, unit: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 lg:col-span-3 space-y-2">
                                            <label className="text-[9px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Início</label>
                                            <input
                                                type="time"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-xl py-3 px-3 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold"
                                                value={newSubTask.startTime}
                                                onChange={e => setNewSubTask({ ...newSubTask, startTime: e.target.value })}
                                            />
                                        </div>
                                        <div className="md:col-span-2 lg:col-span-3 space-y-2">
                                            <label className="text-[9px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Término</label>
                                            <input
                                                type="time"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-xl py-3 px-3 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold"
                                                value={newSubTask.endTime}
                                                onChange={e => setNewSubTask({ ...newSubTask, endTime: e.target.value })}
                                            />
                                        </div>
                                        <div className="md:col-span-2 lg:col-span-3 space-y-2">
                                            <label className="text-[9px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Horas Máquina</label>
                                            <input
                                                type="number"
                                                className="w-full bg-[#111827]/40 border border-white/10 rounded-xl py-3 px-3 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold"
                                                value={newSubTask.machinery}
                                                onChange={e => setNewSubTask({ ...newSubTask, machinery: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Recursos Humanos */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-1.5 h-6 bg-cyan-500 rounded-full pulse-neon"></div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Equipe Alocada</h3>
                                    </div>

                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                                            <div className="md:col-span-2 lg:col-span-3 space-y-2">
                                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Profissão / Função</label>
                                                <select
                                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold appearance-none"
                                                    value={tempWorkerRole}
                                                    onChange={e => setTempWorkerRole(e.target.value)}
                                                >
                                                    <option>Servente</option>
                                                    <option>Pedreiro</option>
                                                    <option>Carpinteiro</option>
                                                    <option>Armador</option>
                                                    <option>Encarregado</option>
                                                    <option>Soldador</option>
                                                    <option>Operador</option>
                                                    <option>Motorista</option>
                                                    <option>Outro</option>
                                                </select>
                                            </div>
                                            {tempWorkerRole === 'Outro' && (
                                                <div className="md:col-span-2 lg:col-span-2 space-y-2">
                                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Especificar</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold placeholder:text-gray-600"
                                                        placeholder="Qual função?"
                                                        value={tempCustomWorkerRole}
                                                        onChange={e => setTempCustomWorkerRole(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                            <div className="md:col-span-1 lg:col-span-1 space-y-2">
                                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Quantidade</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        className="flex-1 bg-[#111827]/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white text-center focus:ring-2 focus:ring-cyan-500/50 transition-all font-bold"
                                                        min="1"
                                                        value={tempWorkerCount}
                                                        onChange={e => setTempWorkerCount(Number(e.target.value))}
                                                    />
                                                    <button
                                                        onClick={addWorkerToSubTask}
                                                        className="p-3.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl shadow-lg shadow-cyan-500/20 transition-all transform active:scale-90"
                                                    >
                                                        <PlusIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lista de Colaboradores */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {newSubTask.workers.map((w, idx) => (
                                                <div key={idx} className="flex items-center gap-3 pl-4 pr-1 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-xl animate-fade-in group hover:bg-cyan-500/20 transition-all">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-cyan-500/60 font-black uppercase tracking-tighter">Colaborador</span>
                                                        <span className="text-xs font-bold text-white uppercase">{w.count}x {w.role === 'Outro' ? w.customRole : w.role}</span>
                                                    </div>
                                                    <button onClick={() => removeWorkerFromSubTask(idx)} className="p-2 text-cyan-500/50 hover:text-red-400 transition-all"><XIcon className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            {newSubTask.workers.length === 0 && (
                                                <div className="w-full py-10 border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center text-brand-med-gray/30 transition-colors group-hover:border-white/10">
                                                    <ConstructionIcon className="w-8 h-8 mb-2 opacity-10" />
                                                    <p className="text-[10px] font-black uppercase tracking-[3px]">Nenhum colaborador alocado</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-8 border-t border-white/5 bg-black/20 flex gap-4">
                                <button onClick={handleCancelSubTaskForm} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all active:scale-95">Cancelar</button>
                                <button onClick={handleSaveSubTask} className="flex-[2] py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-cyan-500/20 transition-all transform hover:-translate-y-1 active:scale-95">Salvar Etapa do Fluxo</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default LeanConstructionPage;
