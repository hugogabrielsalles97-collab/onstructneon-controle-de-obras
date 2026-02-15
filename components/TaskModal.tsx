/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Resource, User } from '../types';
import XIcon from './icons/XIcon';
import PlusIcon from './icons/PlusIcon';
import SparkleIcon from './icons/SparkleIcon';
import WeatherIcon from './icons/WeatherIcon';
import SafetyAnalysisIcon from './icons/SafetyAnalysisIcon';
import ConstructionIcon from './icons/ConstructionIcon';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { disciplineOptions, taskTitleOptions, oaeLocations, frentes, apoios, vaos, unitOptions } from '../utils/constants';


interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => void;
    task: Task | null;
    tasks: Task[];
    baselineTasks: Task[];
    user: User;
    allUsers: User[];
}

type ResourceField = 'plannedManpower' | 'plannedMachinery' | 'actualManpower' | 'actualMachinery';

const ResourceSection: React.FC<{
    title: string;
    resources: Resource[];
    onAdd: (resource: Resource) => void;
    onRemove: (index: number) => void;
    onUpdate: (index: number, resource: Resource) => void;
    rolePlaceholder: string;
    disabled?: boolean;
}> = ({ title, resources, onAdd, onRemove, onUpdate, rolePlaceholder, disabled = false }) => {
    const [newRole, setNewRole] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);

    const handleAddClick = () => {
        if (newRole.trim() && newQuantity > 0) {
            onAdd({ role: newRole, quantity: newQuantity });
            setNewRole('');
            setNewQuantity(1);
        }
    };

    return (
        <div className="space-y-3">
            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] block mb-1">{title}</label>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {resources.map((res, index) => (
                    <div key={index} className="flex items-center gap-2 animate-fade-in group">
                        <input
                            type="text"
                            value={res.role}
                            onChange={(e) => onUpdate(index, { ...res, role: e.target.value })}
                            className="flex-grow bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-sm disabled:opacity-50 transition-all font-medium"
                            disabled={disabled}
                        />
                        <input
                            type="number"
                            value={res.quantity}
                            onChange={(e) => onUpdate(index, { ...res, quantity: parseInt(e.target.value, 10) || 0 })}
                            className="w-16 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-sm disabled:opacity-50 text-center font-bold"
                            min="0"
                            disabled={disabled}
                        />
                        <button type="button" onClick={() => onRemove(index)} className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={disabled} title="Remover Recurso">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
            {!disabled && (
                <div className="flex items-center gap-2 p-2 bg-white/5 rounded-2xl border border-white/10 mt-2">
                    <input
                        type="text"
                        placeholder={rolePlaceholder}
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="flex-grow bg-white/5 border-none rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-sm placeholder:text-gray-600"
                    />
                    <input
                        type="number"
                        placeholder="Qtd"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 1)}
                        className="w-16 bg-white/5 border-none rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-sm text-center font-bold"
                        min="1"
                    />
                    <button type="button" onClick={handleAddClick} className="bg-brand-accent text-white rounded-xl p-2.5 hover:bg-[#e35a10] transition-all shadow-lg shadow-brand-accent/20" title="Adicionar Recurso">
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, task, tasks, baselineTasks, user, allUsers }) => {
    const getInitialFormData = (): Omit<Task, 'id' | 'status'> => {
        const today = new Date().toISOString().split('T')[0];
        return {
            title: '',
            description: '',
            assignee: '',
            discipline: '',
            level: '',
            startDate: today,
            dueDate: today,
            actualStartDate: '',
            actualEndDate: '',
            location: '',
            support: '',
            corte: '',
            quantity: 0,
            unit: '',
            actualQuantity: 0,
            progress: 0,
            plannedManpower: [],
            plannedMachinery: [],
            actualManpower: [],
            actualMachinery: [],
            photos: [],
            observations: '',
            baseline_id: '',
        };
    };

    const [formData, setFormData] = useState<Omit<Task, 'id' | 'status'>>(getInitialFormData());
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMappingBaseline, setIsMappingBaseline] = useState(false);
    const [conflictingTasks, setConflictingTasks] = useState<Task[]>([]);
    const [plannedWeather, setPlannedWeather] = useState<string | null>(null);
    const [actualWeather, setActualWeather] = useState<string | null>(null);
    const [isFetchingPlannedWeather, setIsFetchingPlannedWeather] = useState(false);
    const [isFetchingActualWeather, setIsFetchingActualWeather] = useState(false);
    const [analyzingPhotoIndex, setAnalyzingPhotoIndex] = useState<number | null>(null);
    const [safetyAnalysisResult, setSafetyAnalysisResult] = useState<{ status: 'idle' | 'safe' | 'risk'; message: string }>({ status: 'idle', message: '' });

    const isMaster = user.role === 'Master';
    const isPlanner = user.role === 'Planejador';
    const isManager = user.role === 'Gerenciador';
    const isExecutor = user.role === 'Executor';

    const canEditPlanning = isMaster || isPlanner;
    const canEditExecution = isMaster || isPlanner || isExecutor;
    const canUseAI = isMaster || isManager;

    const isReadOnlyPlanning = !canEditPlanning;
    const isReadOnlyExecution = !canEditExecution;

    const assignableUsers = (allUsers || []).filter(u => u.role !== 'Gerenciador');

    useEffect(() => {
        if (isOpen) {
            if (task) {
                const isAssigneeValid = assignableUsers.some(u => u.fullName === task.assignee);
                setFormData({
                    title: task.title,
                    description: task.description,
                    assignee: isAssigneeValid ? task.assignee : '',
                    discipline: task.discipline || '',
                    level: task.level || '',
                    startDate: task.startDate,
                    dueDate: task.dueDate,
                    actualStartDate: task.actualStartDate || '',
                    actualEndDate: task.actualEndDate || '',
                    location: task.location || '',
                    support: task.support || '',
                    corte: task.corte || '',
                    quantity: task.quantity || 0,
                    unit: task.unit || '',
                    actualQuantity: task.actualQuantity || 0,
                    progress: task.progress || 0,
                    plannedManpower: task.plannedManpower || [],
                    plannedMachinery: task.plannedMachinery || [],
                    actualManpower: task.actualManpower || [],
                    actualMachinery: task.actualMachinery || [],
                    photos: task.photos || [],
                    observations: task.observations || '',
                    baseline_id: task.baseline_id || '',
                });
            } else {
                setFormData(getInitialFormData());
            }
            setConflictingTasks([]);
            setPlannedWeather(null);
            setActualWeather(null);
            setAnalyzingPhotoIndex(null);
            setSafetyAnalysisResult({ status: 'idle', message: '' });
        }
    }, [task, isOpen, allUsers]);

    useEffect(() => {
        if (['Terraplenagem', 'Contenções'].includes(formData.discipline) && formData.level) {
            setFormData(prev => ({ ...prev, title: prev.level }));
        }
    }, [formData.discipline, formData.level]);

    useEffect(() => {
        if (!task && formData.title && formData.startDate && formData.dueDate) {
            const newStartDate = new Date(formData.startDate);
            const newEndDate = new Date(formData.dueDate);

            const conflicts = (tasks || []).filter(existingTask => {
                if (existingTask.title.trim().toLowerCase() !== formData.title.trim().toLowerCase()) {
                    return false;
                }

                const existingStartDate = new Date(existingTask.startDate);
                const existingEndDate = new Date(existingTask.dueDate);

                const overlap = newStartDate <= existingEndDate && newEndDate >= existingStartDate;

                return overlap;
            });

            setConflictingTasks(conflicts);
        } else {
            setConflictingTasks([]);
        }
    }, [formData.title, formData.startDate, formData.dueDate, task, tasks]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if ((name === 'actualStartDate' || name === 'actualEndDate') && value) {
            const selectedDate = new Date(value + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate > today) {
                alert("Não é permitido inserir uma data futura para o avanço real.");
                return;
            }
        }

        setFormData(prev => {
            const newValues = { ...prev, [name]: value };

            if (name === 'discipline') {
                newValues.level = '';
                newValues.location = '';
                newValues.corte = '';
                newValues.support = '';
                newValues.title = '';
            }

            if (name === 'level') {
                newValues.support = '';
                newValues.title = '';
            }

            if (type === 'number') {
                newValues[name] = parseFloat(value) || 0;
            }

            const quant = newValues.quantity;
            const actualQuant = newValues.actualQuantity;

            if (quant > 0) {
                newValues.progress = Math.min(100, Math.round((actualQuant / quant) * 100));
            } else {
                newValues.progress = 0;
            }

            if (name === 'actualStartDate' && !value) {
                newValues.progress = 0;
                newValues.actualQuantity = 0;
                newValues.actualEndDate = '';
            }

            return newValues;
        });
    };

    const handleResourceChange = (field: ResourceField, action: 'add' | 'remove' | 'update', payload: any) => {
        setFormData(prev => {
            const currentResources = prev[field] || [];
            let newResources: Resource[] = [];

            if (action === 'add') {
                newResources = [...currentResources, payload.resource];
            } else if (action === 'remove') {
                newResources = currentResources.filter((_, i) => i !== payload.index);
            } else if (action === 'update') {
                newResources = currentResources.map((res, i) => i === payload.index ? payload.resource : res);
            }

            return { ...prev, [field]: newResources };
        });
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            for (const file of e.target.files) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({
                        ...prev,
                        photos: [...(prev.photos || []), reader.result as string]
                    }));
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        }
    };

    const handleRemovePhoto = (indexToRemove: number) => {
        setFormData(prev => ({
            ...prev,
            photos: (prev.photos || []).filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleAIAssist = async () => {
        setIsAnalyzing(true);
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const { progress, actualEndDate } = formData;
            const currentStatus = progress >= 100 && actualEndDate ? TaskStatus.Completed : (progress > 0 ? TaskStatus.InProgress : TaskStatus.ToDo);

            const prompt = `
            Você é um assistente de engenharia de obras. Seu objetivo é analisar os dados de uma tarefa e gerar uma observação concisa e profissional para um Relatório Diário de Obra (RDO).
            
            Analise os seguintes dados da tarefa:
            - Título: ${formData.title}
            - Disciplina: ${formData.discipline}
            - Status Atual: ${currentStatus}
            - Progresso: ${formData.progress}%
            - Período Planejado: ${formData.startDate} a ${formData.dueDate}
            - Período Real: ${formData.actualStartDate || 'Não iniciado'} a ${formData.actualEndDate || 'Não finalizado'}
            - Quantidade Planejada: ${formData.quantity} ${formData.unit}
            - Quantidade Realizada: ${formData.actualQuantity} ${formData.unit}
            - Mão de Obra Real: ${formData.actualManpower?.map(r => `${r.quantity} ${r.role}`).join(', ') || 'N/A'}
            - Equipamentos Reais: ${formData.actualMachinery?.map(r => `${r.quantity} ${r.role}`).join(', ') || 'N/A'}
            - Observações existentes do usuário: ${formData.observations || 'Nenhuma'}

            Com base nesses dados, gere uma observação para o relatório. A observação deve:
            1. Ser em português do Brasil, em tom técnico e formal.
            2. Resumir o estado atual da tarefa.
            3. Identificar potenciais riscos com base nas datas e progresso.
            4. Se houver riscos, sugerir um ponto de atenção.
            5. Se a tarefa está adiantada ou concluída, dê um parecer positivo.
            6. Seja breve (máximo 3 frases).
            `;

            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent(prompt);
            const aiText = result.response.text();

            setFormData(prev => ({
                ...prev,
                observations: (prev.observations ? prev.observations + '\n\n' : '') + '--- Análise da IA ---\n' + aiText
            }));

        } catch (error) {
            console.error("Erro ao chamar a IA:", error);
            alert(`Erro na IA: ${(error instanceof Error ? error.message : String(error))}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSuggestBaseline = async () => {
        if (baselineTasks.length === 0) {
            alert("Nenhuma linha de base disponível para comparação.");
            return;
        }

        setIsMappingBaseline(true);
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const baselineSummary = baselineTasks.map(t => ({
                id: t.id,
                title: t.title,
                discipline: t.discipline,
                level: t.level,
                location: t.location,
            }));

            const prompt = `
            Vincule esta tarefa de execução a um item da Linha de Base (Macro).
            Tarefa: ${formData.title} / ${formData.discipline} / ${formData.location}
            Opções: ${JSON.stringify(baselineSummary)}
            Responda APENAS o ID escolhido ou "null".
            `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            const sugeridoId = responseText.replace(/['"`]/g, '').toLowerCase() === 'null' ? '' : responseText.replace(/['"`]/g, '');

            if (sugeridoId) {
                setFormData(prev => ({ ...prev, baseline_id: sugeridoId }));
                const baselineTask = baselineTasks.find(t => t.id === sugeridoId);
                if (baselineTask) {
                    alert(`Vínculo sugerido: "${baselineTask.title}"`);
                }
            } else {
                alert("Nenhuma correspondência clara encontrada.");
            }

        } catch (error) {
            console.error("Erro na sugestão de vínculo:", error);
        } finally {
            setIsMappingBaseline(false);
        }
    };

    const handleAnalyzeSafety = async (photoBase64: string, index: number) => {
        setAnalyzingPhotoIndex(index);
        setSafetyAnalysisResult({ status: 'idle', message: '' });
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const mimeType = photoBase64.split(';')[0].split(':')[1];
            const imageData = photoBase64.split(',')[1];

            const prompt = `
            Analise a imagem em busca de riscos de segurança na obra (EPIs, queda, organização).
            Retorne JSON: {"is_safe": boolean, "findings": "descrição"}.
            `;

            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent([
                prompt,
                { inlineData: { data: imageData, mimeType } }
            ]);

            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { is_safe: false, findings: "Falha na análise." };

            setSafetyAnalysisResult({
                status: analysis.is_safe ? 'safe' : 'risk',
                message: analysis.findings,
            });

        } catch (error) {
            console.error("Erro na análise de segurança:", error);
        } finally {
            setAnalyzingPhotoIndex(null);
        }
    };

    const fetchWeather = async (location: string, startDate: string, endDate: string, isForecast: boolean) => {
        const hardcodedLocation = "PARACAMBI-RJ";
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const prompt = `Meteorologia para ${hardcodedLocation} entre ${startDate} e ${endDate}. Resumo técnico curto.`;
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            return "Indisponível.";
        }
    };

    const handleFetchPlannedWeather = async () => {
        if (!formData.startDate || !formData.dueDate) return;
        setIsFetchingPlannedWeather(true);
        setPlannedWeather(null);
        const weather = await fetchWeather(formData.location, formData.startDate, formData.dueDate, true);
        setPlannedWeather(weather);
        setIsFetchingPlannedWeather(false);
    };

    const handleFetchActualWeather = async () => {
        if (!formData.actualStartDate) return;
        setIsFetchingActualWeather(true);
        setActualWeather(null);
        const weather = await fetchWeather(formData.location, formData.actualStartDate, formData.actualEndDate || formData.actualStartDate, false);
        setActualWeather(weather);
        setIsFetchingActualWeather(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let finalStatus: TaskStatus;
        if (formData.progress >= 100 && formData.actualEndDate) {
            finalStatus = TaskStatus.Completed;
        } else if (formData.progress > 0) {
            finalStatus = TaskStatus.InProgress;
        } else {
            finalStatus = TaskStatus.ToDo;
        }

        const finalFormData = { ...formData };
        if (finalStatus === TaskStatus.Completed) {
            finalFormData.progress = 100;
            finalFormData.actualQuantity = finalFormData.quantity;
        }

        const taskToSave: Task = {
            id: task?.id || new Date().toISOString(),
            ...finalFormData,
            status: finalStatus,
            actualStartDate: formData.actualStartDate || undefined,
            actualEndDate: formData.actualEndDate || undefined,
        };
        onSave(taskToSave);
    };

    if (!isOpen) return null;

    const levelOptions = formData.discipline ? disciplineOptions[formData.discipline] || [] : [];
    const isOAE = formData.discipline === 'Obras de arte especiais';
    const isOAESuperestrutura = isOAE && formData.level === 'Superestrutura';
    const specificTaskOptions = formData.discipline && formData.level ? taskTitleOptions[formData.discipline]?.[formData.level] : undefined;
    const isTitleAutoPopulated = ['Terraplenagem', 'Contenções'].includes(formData.discipline);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-[#0a0f18]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-[0_0_100px_-20px_rgba(227,90,16,0.3)] max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="p-8 pb-4 flex justify-between items-center border-b border-white/5 bg-gradient-to-r from-brand-accent/5 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center shadow-lg shadow-brand-accent/20 rotate-3 transition-transform hover:rotate-0 cursor-default">
                            <ConstructionIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">
                                {task ? 'Detalhes da Tarefa' : 'Nova Atividade'}
                            </h2>
                            <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mt-0.5">Módulo de Planejamento e Controle</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-med-gray hover:text-white hover:bg-white/10 transition-all border border-white/10"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-10 custom-scrollbar">
                    <form id="task-form" onSubmit={handleSubmit} className="space-y-12">

                        {/* 1. SEÇÃO DE PLANEJAMENTO */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1.5 h-6 bg-brand-accent rounded-full pulse-neon"></div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Configurações de Planejamento</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white/5 rounded-3xl border border-white/5 group hover:border-brand-accent/20 transition-all duration-500">

                                {conflictingTasks.length > 0 && (
                                    <div className="col-span-1 md:col-span-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-shake">
                                        <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
                                            <XIcon className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-red-400 uppercase tracking-tight">Conflito de Alocação Detectado</p>
                                            <p className="text-xs text-red-300 opacity-80 mt-0.5">
                                                Já existem {conflictingTasks.length} tarefa(s) "{formData.title}" alocando um total de <strong>{conflictingTasks.reduce((acc, t) => acc + (t.quantity || 0), 0)} {formData.unit}</strong> para este período.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Inputs Estilizados */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Disciplina</label>
                                    <select
                                        name="discipline"
                                        value={formData.discipline}
                                        onChange={handleChange}
                                        required
                                        disabled={isReadOnlyPlanning}
                                        className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all disabled:opacity-50 appearance-none font-bold"
                                        style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, gray 50%), linear-gradient(135deg, gray 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                                    >
                                        <option value="">Selecione a Disciplina</option>
                                        {Object.keys(disciplineOptions).map(disc => <option key={disc} value={disc}>{disc}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Nível / Item</label>
                                    <select
                                        name="level"
                                        value={formData.level}
                                        onChange={handleChange}
                                        required
                                        disabled={!formData.discipline || isReadOnlyPlanning}
                                        className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all appearance-none font-bold"
                                    >
                                        <option value="">Selecione o Nível</option>
                                        {levelOptions.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                    </select>
                                </div>

                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Título da Atividade</label>
                                    {isTitleAutoPopulated ? (
                                        <div className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-brand-accent/80 font-black italic tracking-tight">{formData.title}</div>
                                    ) : specificTaskOptions ? (
                                        <select
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            required
                                            disabled={isReadOnlyPlanning}
                                            className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all appearance-none font-bold"
                                        >
                                            <option value="">Selecione a Tarefa</option>
                                            {specificTaskOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            placeholder="Descreva a atividade..."
                                            required
                                            disabled={!formData.discipline || !formData.level || isReadOnlyPlanning}
                                            className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold"
                                        />
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Localização</label>
                                    <select
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        required
                                        disabled={isReadOnlyPlanning}
                                        className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold"
                                    >
                                        <option value="">Selecione o Local</option>
                                        {(isOAE ? oaeLocations : frentes).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">
                                        {isOAE ? (isOAESuperestrutura ? 'Vão' : 'Apoio') : 'Sub-Trecho (Corte)'}
                                    </label>
                                    {isOAE ? (
                                        <select
                                            name="support"
                                            value={formData.support}
                                            onChange={handleChange}
                                            required
                                            disabled={isReadOnlyPlanning}
                                            className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all appearance-none font-bold"
                                        >
                                            <option value="">{isOAESuperestrutura ? 'Selecione o Vão' : 'Selecione o Apoio'}</option>
                                            {(isOAESuperestrutura ? vaos : apoios).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="corte"
                                            value={formData.corte}
                                            onChange={handleChange}
                                            placeholder="Ex: Estaca 100+10"
                                            disabled={isReadOnlyPlanning}
                                            className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold"
                                        />
                                    )}
                                </div>

                                <div className="col-span-1 md:col-span-2 p-6 bg-brand-accent/5 rounded-3xl border border-brand-accent/10 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-brand-accent uppercase tracking-[2px]">Vínculo com Linha de Base (Macro)</label>
                                        <button
                                            type="button"
                                            onClick={handleSuggestBaseline}
                                            disabled={isMappingBaseline || !formData.title || isReadOnlyPlanning}
                                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/5 py-2 px-4 rounded-xl hover:bg-white/10 transition-all border border-white/10 text-brand-med-gray"
                                        >
                                            <SparkleIcon className={`w-3.5 h-3.5 ${isMappingBaseline ? 'animate-spin' : 'text-purple-400'}`} />
                                            {isMappingBaseline ? 'MAPEANDO...' : 'Sugerir com IA'}
                                        </button>
                                    </div>
                                    <select
                                        name="baseline_id"
                                        value={formData.baseline_id}
                                        onChange={handleChange}
                                        disabled={isReadOnlyPlanning}
                                        className="w-full bg-[#0a0f18]/60 border border-brand-accent/10 rounded-2xl py-3 px-4 text-white font-medium text-sm"
                                    >
                                        <option value="">Busca inteligente de macro-atividades...</option>
                                        {baselineTasks.map(bt => <option key={bt.id} value={bt.id}>{bt.title} [{bt.discipline}]</option>)}
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* 2. RECURSOS E PRAZOS */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Recursos e Cronograma</h3>
                            </div>

                            <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Responsável</label>
                                        </div>
                                        <select
                                            name="assignee"
                                            value={formData.assignee}
                                            onChange={handleChange}
                                            disabled={isReadOnlyPlanning}
                                            className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-brand-accent/50 font-bold tracking-tight"
                                        >
                                            <option value="">Selecione um responsável...</option>
                                            {assignableUsers.map(u => <option key={u.username} value={u.fullName}>{u.fullName} • {u.role}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Qnt. Prevista</label>
                                            <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-4 px-4 text-white text-center font-black text-lg" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Unidade</label>
                                            <select name="unit" value={formData.unit} onChange={handleChange} className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-4 px-4 text-white text-center font-black">
                                                <option value="">MUD</option>
                                                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4 p-6 bg-white/5 rounded-3xl border border-white/5">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-black text-cyan-400 uppercase tracking-[2px]">Prazo de Execução</label>
                                            <button
                                                type="button"
                                                onClick={handleFetchPlannedWeather}
                                                className="text-[9px] font-black text-white/50 hover:text-cyan-400 uppercase tracking-widest flex items-center gap-2 transition-all p-1"
                                            >
                                                <WeatherIcon className="w-3.5 h-3.5" /> Predição Meteorológica
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="flex-1 bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white text-xs font-mono" />
                                            <div className="text-gray-600 font-bold">→</div>
                                            <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className="flex-1 bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white text-xs font-mono" />
                                        </div>
                                        {plannedWeather && (
                                            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-[10px] text-cyan-300 font-medium leading-relaxed italic">
                                                " {plannedWeather} "
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        <ResourceSection
                                            title="Equipe Necessária"
                                            resources={formData.plannedManpower}
                                            onAdd={(res) => handleResourceChange('plannedManpower', 'add', { resource: res })}
                                            onRemove={(idx) => handleResourceChange('plannedManpower', 'remove', { index: idx })}
                                            onUpdate={(idx, res) => handleResourceChange('plannedManpower', 'update', { index: idx, resource: res })}
                                            rolePlaceholder="Ex: Carpinteiro"
                                            disabled={isReadOnlyPlanning}
                                        />
                                        <ResourceSection
                                            title="Frota de Apoio"
                                            resources={formData.plannedMachinery}
                                            onAdd={(res) => handleResourceChange('plannedMachinery', 'add', { resource: res })}
                                            onRemove={(idx) => handleResourceChange('plannedMachinery', 'remove', { index: idx })}
                                            onUpdate={(idx, res) => handleResourceChange('plannedMachinery', 'update', { index: idx, resource: res })}
                                            rolePlaceholder="Ex: Caminhão Munck"
                                            disabled={isReadOnlyPlanning}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 3. CONTROLE DE EXECUÇÃO */}
                        {(task || formData.actualStartDate) && (
                            <section className="space-y-6 animate-slide-up">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-1.5 h-6 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)]"></div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Avanço Físico e Diário de Obras</h3>
                                </div>

                                <div className="p-8 bg-green-500/5 rounded-[2.5rem] border border-green-500/10 space-y-10">

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-green-400 uppercase tracking-[2px]">Cronograma Realizado</label>
                                            <div className="flex gap-4">
                                                <input type="date" name="actualStartDate" value={formData.actualStartDate || ''} onChange={handleChange} className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-mono text-center" />
                                                <input type="date" name="actualEndDate" value={formData.actualEndDate || ''} onChange={handleChange} className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-mono text-center" />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end mb-1">
                                                <label className="text-[10px] font-black text-green-400 uppercase tracking-[2px]">Avanço ({formData.progress}%)</label>
                                                <span className="text-[10px] font-bold text-brand-med-gray italic tracking-tight">{formData.actualQuantity} / {formData.quantity} {formData.unit}</span>
                                            </div>
                                            <div className="relative h-12 bg-black/40 rounded-2xl border border-white/5 overflow-hidden group">
                                                <div
                                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 to-green-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                                                    style={{ width: `${formData.progress}%` }}
                                                >
                                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shimmer_2s_infinite_linear]"></div>
                                                </div>
                                                <input
                                                    type="number"
                                                    name="actualQuantity"
                                                    value={formData.actualQuantity}
                                                    onChange={handleChange}
                                                    className="absolute inset-0 w-full h-full bg-transparent text-center font-black text-xl text-white focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Galeria de Evidências</label>
                                            <label htmlFor="photo-upload" className="cursor-pointer text-[9px] font-black text-brand-accent uppercase border border-brand-accent/30 py-1.5 px-4 rounded-xl hover:bg-brand-accent hover:text-white transition-all">
                                                Adicionar Registro
                                            </label>
                                            <input id="photo-upload" type="file" className="sr-only" accept="image/*" multiple onChange={handlePhotoUpload} />
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                            {formData.photos?.map((photo, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white/5 group hover:border-brand-accent/50 transition-all shadow-xl">
                                                    <img src={photo} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button type="button" onClick={() => handleAnalyzeSafety(photo, idx)} className="p-2 bg-blue-500 rounded-lg hover:bg-blue-600 shadow-lg transition-transform active:scale-90"><SafetyAnalysisIcon className="w-4 h-4 text-white" /></button>
                                                        <button type="button" onClick={() => handleRemovePhoto(idx)} className="p-2 bg-red-500 rounded-lg hover:bg-red-600 shadow-lg transition-transform active:scale-90"><XIcon className="w-4 h-4 text-white" /></button>
                                                    </div>
                                                </div>
                                            ))}
                                            <label htmlFor="photo-upload" className="aspect-square rounded-2xl border-2 border-dashed border-white/5 hover:border-white/20 hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                                <PlusIcon className="w-6 h-6 text-gray-700 group-hover:text-brand-accent transition-colors" />
                                            </label>
                                        </div>

                                        {safetyAnalysisResult.status !== 'idle' && (
                                            <div className={`p-4 rounded-2xl border ${safetyAnalysisResult.status === 'safe' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'} animate-fade-in`}>
                                                <p className="text-[10px] font-black uppercase tracking-widest mb-1">{safetyAnalysisResult.status === 'safe' ? 'Verificação Positiva' : 'Alerta de Segurança'}</p>
                                                <p className="text-xs text-brand-med-gray italic tracking-tight leading-relaxed">"{safetyAnalysisResult.message}"</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                                                <label className="text-[10px] font-black text-white uppercase tracking-[2px]">Mão de Obra Realizada</label>
                                            </div>
                                            <ResourceSection
                                                title="Mão de Obra Real"
                                                resources={formData.actualManpower || []}
                                                onAdd={(res) => handleResourceChange('actualManpower', 'add', { resource: res })}
                                                onRemove={(idx) => handleResourceChange('actualManpower', 'remove', { index: idx })}
                                                onUpdate={(idx, res) => handleResourceChange('actualManpower', 'update', { index: idx, resource: res })}
                                                rolePlaceholder="Cargo/Função Real"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                                                <label className="text-[10px] font-black text-white uppercase tracking-[2px]">Equipamentos Reais</label>
                                            </div>
                                            <ResourceSection
                                                title="Equipamentos Reais"
                                                resources={formData.actualMachinery || []}
                                                onAdd={(res) => handleResourceChange('actualMachinery', 'add', { resource: res })}
                                                onRemove={(idx) => handleResourceChange('actualMachinery', 'remove', { index: idx })}
                                                onUpdate={(idx, res) => handleResourceChange('actualMachinery', 'update', { index: idx, resource: res })}
                                                rolePlaceholder="Equipamento Real"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Observações Técnicas (RDO)</label>
                                            <button
                                                type="button"
                                                onClick={handleAIAssist}
                                                disabled={isAnalyzing}
                                                className="text-[9px] font-black text-brand-accent uppercase flex items-center gap-2 bg-brand-accent/10 py-1.5 px-4 rounded-xl border border-brand-accent/20 hover:bg-brand-accent hover:text-white transition-all shadow-inner"
                                            >
                                                <SparkleIcon className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                                                Gerador Assistido por IA
                                            </button>
                                        </div>
                                        <textarea
                                            name="observations"
                                            value={formData.observations || ''}
                                            onChange={handleChange}
                                            rows={4}
                                            placeholder="Descreva as ocorrências do dia, motivos de atraso ou observações de campo..."
                                            className="w-full bg-black/40 border border-white/10 rounded-3xl py-4 px-6 text-white text-sm placeholder:text-gray-700 focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </section>
                        )}
                    </form>
                </div>

                {/* Footer / Actions */}
                <div className="p-8 border-t border-white/10 bg-[#060a12]/80 flex justify-between items-center gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3.5 rounded-2xl text-brand-med-gray hover:text-white hover:bg-white/5 transition-all text-sm font-black uppercase tracking-widest border border-white/5"
                    >
                        Descartar
                    </button>
                    <div className="flex gap-4">
                        <button
                            form="task-form"
                            type="submit"
                            disabled={isManager}
                            className="px-10 py-3.5 bg-brand-accent text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:bg-[#e35a10] hover:scale-105 active:scale-95 shadow-xl shadow-brand-accent/30 disabled:opacity-50 disabled:cursor-not-allowed group flex items-center gap-3"
                        >
                            <span>Efetivar Lançamento</span>
                            <div className="w-2 h-2 rounded-full bg-white animate-ping opacity-75 group-hover:block hidden"></div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskModal;