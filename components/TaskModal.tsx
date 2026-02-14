/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Resource, User } from '../types';
import XIcon from './icons/XIcon';
import PlusIcon from './icons/PlusIcon';
import SparkleIcon from './icons/SparkleIcon';
import WeatherIcon from './icons/WeatherIcon';
import SafetyAnalysisIcon from './icons/SafetyAnalysisIcon';
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
        <div>
            <label className="block text-sm font-medium text-brand-med-gray mb-1">{title}</label>
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-2">
                {resources.map((res, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={res.role}
                            onChange={(e) => onUpdate(index, { ...res, role: e.target.value })}
                            className="flex-grow bg-brand-darkest/50 border border-brand-darkest rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-accent text-sm disabled:opacity-50"
                            disabled={disabled}
                        />
                        <input
                            type="number"
                            value={res.quantity}
                            onChange={(e) => onUpdate(index, { ...res, quantity: parseInt(e.target.value, 10) || 0 })}
                            className="w-16 bg-brand-darkest/50 border border-brand-darkest rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-accent text-sm disabled:opacity-50"
                            min="0"
                            disabled={disabled}
                        />
                        <button type="button" onClick={() => onRemove(index)} className="text-red-500/70 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled={disabled} title="Remover Recurso">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
            {!disabled && (
                <div className="flex items-center gap-2 mt-2 border-t border-brand-dark pt-2">
                    <input
                        type="text"
                        placeholder={rolePlaceholder}
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="flex-grow bg-brand-darkest/50 border border-brand-darkest rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-accent text-sm"
                    />
                    <input
                        type="number"
                        placeholder="Qtd"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 1)}
                        className="w-16 bg-brand-darkest/50 border border-brand-darkest rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-accent text-sm"
                        min="1"
                    />
                    <button type="button" onClick={handleAddClick} className="bg-brand-accent/80 text-white rounded p-1.5 hover:bg-brand-accent" title="Adicionar Recurso">
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
            2. Resumir o estado atual da tarefa (ex: "Atividade em andamento com X% de avanço físico.").
            3. Identificar potenciais riscos com base nas datas e progresso. Se a data de término prevista está próxima e o progresso está baixo, aponte o risco de atraso.
            4. Se houver riscos, sugerir um ponto de atenção (ex: "Ponto de atenção: necessidade de intensificar os trabalhos para cumprimento do prazo.").
            5. Se a tarefa está adiantada ou concluída, dê um parecer positivo.
            6. Seja breve e direto ao ponto (máximo 3 frases).
        `;

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            const aiText = result.response.text();

            setFormData(prev => ({
                ...prev,
                observations: (prev.observations ? prev.observations + '\n\n' : '') + '--- Análise da IA ---\n' + aiText
            }));

        } catch (error) {
            console.error("Erro ao chamar a API Gemini:", error);
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
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const baselineSummary = baselineTasks.map(t => ({
                id: t.id,
                title: t.title,
                discipline: t.discipline,
                level: t.level,
                location: t.location,
                quantity: t.quantity,
                unit: t.unit,
                support: t.support,
                corte: t.corte,
                description: t.description
            }));

            const prompt = `
            Você é um assistente de planejamento de obras. Sua tarefa é vincular uma tarefa de execução (que é mais detalhada/nível abaixo) a uma tarefa da Linha de Base (que é macro/nível acima).

            Tarefa de Execução:
            - Título: ${formData.title}
            - Disciplina: ${formData.discipline}
            - Nível: ${formData.level}
            - Local/Frente: ${formData.location}
            - Quantidade: ${formData.quantity} ${formData.unit}
            - Apoio/Vão: ${formData.support || 'N/A'}
            - Corte: ${formData.corte || 'N/A'}
            - Descrição: ${formData.description || 'N/A'}

            Linha de Base Disponível (JSON):
            ${JSON.stringify(baselineSummary)}

            Instruções:
            1. Encontre a tarefa da Linha de Base que melhor engloba esta tarefa de execução. 
            2. Use todas as informações disponíveis (Local, Disciplina, Apoio, Corte, etc.) para garantir que a tarefa de execução pertence a este macro.
            3. Tarefas de execução são sub-atividades de um item da linha de base.
            4. Responda APENAS o ID da tarefa da Linha de Base escolhida. Se não encontrar nenhuma correspondência mínima, responda "null".
            `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            const sugeridoId = responseText.replace(/['"`]/g, '').toLowerCase() === 'null' ? '' : responseText.replace(/['"`]/g, '');

            if (sugeridoId) {
                setFormData(prev => ({ ...prev, baseline_id: sugeridoId }));
                const baselineTask = baselineTasks.find(t => t.id === sugeridoId);
                if (baselineTask) {
                    alert(`Vínculo sugerido com a Linha de Base: "${baselineTask.title}" (${baselineTask.id})`);
                }
            } else {
                alert("A IA não encontrou uma correspondência clara na Linha de Base.");
            }

        } catch (error) {
            console.error("Erro na sugestão de vínculo:", error);
            alert(`Erro na IA: ${(error instanceof Error ? error.message : String(error))}`);
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
            Você é um especialista em segurança do trabalho na construção civil. Analise a imagem fornecida em busca de riscos de segurança.
            Sua resposta DEVE ser um objeto JSON com a seguinte estrutura: {"is_safe": boolean, "findings": "descrição"}.
            - "is_safe": deve ser 'true' se NENHUM risco for encontrado, e 'false' caso contrário.
            - "findings": deve conter uma descrição. Se 'is_safe' for true, a mensagem deve ser "A cena aparenta estar segura e em conformidade com as boas práticas.". Se 'is_safe' for false, liste os riscos encontrados de forma clara e objetiva (ex: "Trabalhador sem capacete.", "Falta de guarda-corpo em plataforma elevada.", "Materiais obstruindo passagem.").

            Foque em riscos comuns:
            - Falta de Equipamento de Proteção Individual (EPI): capacetes, botas, luvas, óculos, coletes, cintos de segurança para altura.
            - Condições de trabalho em altura: falta de guarda-corpo, andaimes instáveis, uso incorreto de escadas.
            - Riscos de tropeço e queda: cabos expostos, materiais desorganizados no chão.
            - Proximidade perigosa a máquinas pesadas sem sinalização.
            - Escavações sem escoramento adequado.
        `;

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent([
                prompt,
                { inlineData: { data: imageData, mimeType } }
            ]);

            const responseText = result.response.text();

            // Tenta extrair JSON da resposta
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { is_safe: false, findings: "Erro ao analisar resposta. Formato inválido." };

            setSafetyAnalysisResult({
                status: analysis.is_safe ? 'safe' : 'risk',
                message: analysis.findings,
            });

        } catch (error) {
            console.error("Erro na análise de segurança da IA:", error);
            setSafetyAnalysisResult({
                status: 'risk',
                message: 'Não foi possível analisar a imagem. A resposta da IA pode estar em um formato inesperado. Verifique o console.'
            });
        } finally {
            setAnalyzingPhotoIndex(null);
        }
    };

    const fetchWeather = async (location: string, startDate: string, endDate: string, isForecast: boolean) => {
        const hardcodedLocation = "PARACAMBI-RJ";
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const promptType = isForecast ? "previsão do tempo" : "meteorologia histórica";
            const prompt = `
            Aja como um serviço de meteorologia. Forneça um resumo conciso da ${promptType} para a cidade ou localidade de "${hardcodedLocation}" entre as datas ${startDate} e ${endDate}.
            A resposta deve ser curta e direta, ideal para um relatório de construção. Inclua:
            - Condição principal (ex: Ensolarado, Parcialmente Nublado, Chuva, Tempestades).
            - Temperatura média aproximada.
            - Chance ou resumo de precipitação.
            Exemplo de resposta: "Parcialmente nublado com chance de chuvas isoladas. Temp. média de 25°C. Baixa probabilidade de chuva contínua."
        `;

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);

            return result.response.text();

        } catch (error) {
            console.error("Erro ao buscar dados meteorológicos:", error);
            return "Não foi possível obter os dados meteorológicos.";
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

        if (finalFormData.discipline === 'Obras de arte especiais') {
            finalFormData.corte = '';
        } else {
            finalFormData.support = '';
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

    const getProgressHelpText = () => {
        if (!formData.actualStartDate) {
            return "Defina uma data de início real para registrar a quantidade executada.";
        }
        if (formData.progress >= 100 && !formData.actualEndDate) {
            return "Defina uma data de fim real para marcar a tarefa como Concluída.";
        }
        if (formData.quantity <= 0) {
            return "Defina a quantidade planejada para calcular o avanço.";
        }
        return "O avanço é calculado automaticamente com base na quantidade real.";
    };

    const levelOptions = formData.discipline ? disciplineOptions[formData.discipline] || [] : [];
    const isOAE = formData.discipline === 'Obras de arte especiais';
    const isOAESuperestrutura = isOAE && formData.level === 'Superestrutura';
    const isOtherDiscipline = formData.discipline && !isOAE;

    const specificTaskOptions = formData.discipline && formData.level ? taskTitleOptions[formData.discipline]?.[formData.level] : undefined;
    const isTitleAutoPopulated = ['Terraplenagem', 'Contenções'].includes(formData.discipline);


    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div className="bg-brand-dark rounded-lg shadow-2xl shadow-brand-accent/20 border border-brand-accent/30 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-brand-accent">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                        <button onClick={onClose} className="text-brand-med-gray hover:text-white text-3xl leading-none">&times;</button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        {/* --- SEÇÃO DE PLANEJAMENTO --- */}
                        <div className={`bg-brand-darkest/20 p-4 rounded-lg ${isReadOnlyPlanning ? 'opacity-70' : ''}`}>
                            <h3 className="text-lg font-semibold text-brand-accent mb-4 border-b border-brand-accent/20 pb-2">Planejamento</h3>

                            {conflictingTasks.length > 0 && (
                                <div className="p-3 mb-4 border-2 border-red-500 bg-red-500/10 rounded-lg animate-blinking-border">
                                    <h4 className="font-bold text-red-400">Atenção: Conflito de Alocação</h4>
                                    <p className="text-sm text-red-300 mt-1">
                                        Já existem {conflictingTasks.length} tarefas "{formData.title}" alocadas neste período.
                                    </p>
                                    <ul className="text-xs text-red-300/80 mt-2 list-disc list-inside space-y-1 max-h-24 overflow-y-auto">
                                        {conflictingTasks.map(t => (
                                            <li key={t.id}>
                                                <strong>{t.location || 'N/A'} ({t.assignee}):</strong> {new Date(t.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a {new Date(t.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="discipline" className="block text-sm font-medium text-brand-med-gray">Disciplina</label>
                                        <select name="discipline" id="discipline" value={formData.discipline} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed">
                                            <option value="">Selecione a Disciplina</option>
                                            {Object.keys(disciplineOptions).map(disc => (
                                                <option key={disc} value={disc}>{disc}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="level" className="block text-sm font-medium text-brand-med-gray">Nível</label>
                                        <select name="level" id="level" value={formData.level} onChange={handleChange} required disabled={!formData.discipline || isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:opacity-50 disabled:cursor-not-allowed">
                                            <option value="">Selecione o Nível</option>
                                            {levelOptions.map(lvl => (
                                                <option key={lvl} value={lvl}>{lvl}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {isOAE && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="location" className="block text-sm font-medium text-brand-med-gray">Local</label>
                                            <select name="location" id="location" value={formData.location} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed">
                                                <option value="">Selecione o Local</option>
                                                {oaeLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            {isOAESuperestrutura ? (
                                                <>
                                                    <label htmlFor="support" className="block text-sm font-medium text-brand-med-gray">Vão</label>
                                                    <select name="support" id="support" value={formData.support} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed">
                                                        <option value="">Selecione o Vão</option>
                                                        {vaos.map(v => <option key={v} value={v}>{v}</option>)}
                                                    </select>
                                                </>
                                            ) : (
                                                <>
                                                    <label htmlFor="support" className="block text-sm font-medium text-brand-med-gray">Apoio</label>
                                                    <select name="support" id="support" value={formData.support} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed">
                                                        <option value="">Selecione o Apoio</option>
                                                        {apoios.map(a => <option key={a} value={a}>{a}</option>)}
                                                    </select>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isOtherDiscipline && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="location" className="block text-sm font-medium text-brand-med-gray">Frente</label>
                                            <select name="location" id="location" value={formData.location} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed">
                                                <option value="">Selecione a Frente</option>
                                                {frentes.map(frt => <option key={frt} value={frt}>{frt}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="corte" className="block text-sm font-medium text-brand-med-gray">Corte</label>
                                            <input type="text" name="corte" id="corte" value={formData.corte} onChange={handleChange} placeholder="Ex: Estaca 10-20" disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed" />
                                        </div>
                                    </div>
                                )}

                                {!formData.discipline && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2">
                                            <label htmlFor="location" className="block text-sm font-medium text-brand-med-gray">Local / Frente</label>
                                            <input type="text" disabled placeholder="Selecione uma disciplina" className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:opacity-50" />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="title" className="block text-sm font-medium text-brand-med-gray">Tarefa</label>
                                    {isTitleAutoPopulated ? (
                                        <input type="text" name="title" id="title" value={formData.title} readOnly className="mt-1 block w-full bg-brand-darkest/80 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-brand-med-gray focus:outline-none cursor-not-allowed" />
                                    ) : specificTaskOptions ? (
                                        <select name="title" id="title" value={formData.title} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed">
                                            <option value="">Selecione a Tarefa</option>
                                            {specificTaskOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} required disabled={!formData.discipline || !formData.level || isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:opacity-50 disabled:cursor-not-allowed" />
                                    )}
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label htmlFor="baseline_id" className="block text-sm font-medium text-brand-med-gray">Vínculo com Linha de Base (Macro)</label>
                                        <button
                                            type="button"
                                            onClick={() => canUseAI ? handleSuggestBaseline() : alert('Upgrade necessário para usar IA.')}
                                            disabled={isMappingBaseline || !formData.title || isReadOnlyPlanning}
                                            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <SparkleIcon className="w-3.5 h-3.5" />
                                            {isMappingBaseline ? 'Vinculando...' : 'Sugerir Vínculo com IA'}
                                        </button>
                                    </div>
                                    <select
                                        name="baseline_id"
                                        id="baseline_id"
                                        value={formData.baseline_id || ''}
                                        onChange={handleChange}
                                        disabled={isReadOnlyPlanning}
                                        className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed text-xs"
                                    >
                                        <option value="">Nenhum vínculo selecionado</option>
                                        {baselineTasks.map(bt => (
                                            <option key={bt.id} value={bt.id}>
                                                [{bt.id}] {bt.title} - {bt.discipline}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="assignee" className="block text-sm font-medium text-brand-med-gray">Responsável</label>
                                    <select
                                        name="assignee"
                                        id="assignee"
                                        value={formData.assignee}
                                        onChange={handleChange}
                                        required
                                        disabled={isReadOnlyPlanning}
                                        className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed"
                                    >
                                        <option value="">Selecione um responsável</option>
                                        {assignableUsers.map(u => (
                                            <option key={u.username} value={u.fullName}>
                                                {u.fullName} ({u.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                    <div>
                                        <label htmlFor="startDate" className="block text-sm font-medium text-brand-med-gray">Início (Prev.)</label>
                                        <input type="date" name="startDate" id="startDate" value={formData.startDate} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="dueDate" className="block text-sm font-medium text-brand-med-gray">Fim (Prev.)</label>
                                            <button
                                                type="button"
                                                onClick={() => canUseAI ? handleFetchPlannedWeather() : alert('Upgrade necessário para usar IA.')}
                                                disabled={isFetchingPlannedWeather || !formData.startDate || !formData.dueDate || isReadOnlyPlanning}
                                                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <WeatherIcon className="w-3.5 h-3.5" />
                                                {isFetchingPlannedWeather ? 'Verificando...' : 'Previsão do Tempo com IA'}
                                            </button>
                                        </div>
                                        <input type="date" name="dueDate" id="dueDate" value={formData.dueDate} onChange={handleChange} required disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed" />
                                    </div>
                                </div>

                                {(isFetchingPlannedWeather || plannedWeather) && (
                                    <div className="mt-2 p-2 bg-brand-darkest/50 border border-brand-dark rounded-md text-sm text-cyan-300">
                                        {isFetchingPlannedWeather ? 'Analisando previsão do tempo...' : plannedWeather}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <ResourceSection
                                        title="Rec. Humanos (Previsto)"
                                        resources={formData.plannedManpower}
                                        onAdd={(res) => handleResourceChange('plannedManpower', 'add', { resource: res })}
                                        onRemove={(idx) => handleResourceChange('plannedManpower', 'remove', { index: idx })}
                                        onUpdate={(idx, res) => handleResourceChange('plannedManpower', 'update', { index: idx, resource: res })}
                                        rolePlaceholder="Função do colaborador"
                                        disabled={isReadOnlyPlanning}
                                    />
                                    <ResourceSection
                                        title="Maquinário (Previsto)"
                                        resources={formData.plannedMachinery}
                                        onAdd={(res) => handleResourceChange('plannedMachinery', 'add', { resource: res })}
                                        onRemove={(idx) => handleResourceChange('plannedMachinery', 'remove', { index: idx })}
                                        onUpdate={(idx, res) => handleResourceChange('plannedMachinery', 'update', { index: idx, resource: res })}
                                        rolePlaceholder="Tipo de máquina"
                                        disabled={isReadOnlyPlanning}
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex-grow">
                                        <label htmlFor="quantity" className="block text-sm font-medium text-brand-med-gray">Quantidade Prevista</label>
                                        <input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} min="0" disabled={isReadOnlyPlanning} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed" />
                                    </div>
                                    <div className="w-1/3">
                                        <label htmlFor="unit" className="block text-sm font-medium text-brand-med-gray">Unidade</label>
                                        <select
                                            name="unit"
                                            id="unit"
                                            value={formData.unit}
                                            onChange={handleChange}
                                            required
                                            disabled={isReadOnlyPlanning}
                                            className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed"
                                        >
                                            <option value="">Selecione</option>
                                            {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- SEÇÃO DE EXECUÇÃO --- */}
                        <div className={`mt-6 pt-4 border-t border-brand-accent/50 bg-brand-darkest/40 p-4 rounded-lg ${isReadOnlyExecution ? 'opacity-70' : ''}`}>
                            <h3 className="text-lg font-semibold text-brand-accent mb-4 border-b border-brand-accent/20 pb-2">Execução (Produção)</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                    <div>
                                        <div className="flex justify-between items-center">
                                            <label htmlFor="actualStartDate" className="block text-sm font-medium text-brand-med-gray">Início (Real)</label>
                                            <button
                                                type="button"
                                                onClick={() => canUseAI ? handleFetchActualWeather() : alert('Upgrade necessário para usar IA.')}
                                                disabled={isFetchingActualWeather || !formData.actualStartDate || isReadOnlyExecution}
                                                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <WeatherIcon className="w-3.5 h-3.5" />
                                                {isFetchingActualWeather ? 'Verificando...' : 'Meteorologia (Real) com IA'}
                                            </button>
                                        </div>
                                        <input type="date" name="actualStartDate" id="actualStartDate" value={formData.actualStartDate} onChange={handleChange} disabled={isReadOnlyExecution} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label htmlFor="actualEndDate" className="block text-sm font-medium text-brand-med-gray">Fim (Real)</label>
                                        <input type="date" name="actualEndDate" id="actualEndDate" value={formData.actualEndDate} onChange={handleChange} disabled={isReadOnlyExecution} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed" />
                                    </div>
                                </div>

                                {(isFetchingActualWeather || actualWeather) && (
                                    <div className="mt-2 p-2 bg-brand-darkest/50 border border-brand-dark rounded-md text-sm text-cyan-300">
                                        {isFetchingActualWeather ? 'Analisando meteorologia do período...' : actualWeather}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label htmlFor="actualQuantity" className="block text-sm font-medium text-brand-med-gray">Quantidade Real</label>
                                        <input type="number" name="actualQuantity" id="actualQuantity" value={formData.actualQuantity} onChange={handleChange} max={formData.quantity} min="0" disabled={!formData.actualStartDate || isReadOnlyExecution} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:opacity-50 disabled:cursor-not-allowed" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <ResourceSection
                                        title="Rec. Humanos (Real)"
                                        resources={formData.actualManpower || []}
                                        onAdd={(res) => handleResourceChange('actualManpower', 'add', { resource: res })}
                                        onRemove={(idx) => handleResourceChange('actualManpower', 'remove', { index: idx })}
                                        onUpdate={(idx, res) => handleResourceChange('actualManpower', 'update', { index: idx, resource: res })}
                                        rolePlaceholder="Função do colaborador"
                                        disabled={!formData.actualStartDate || isReadOnlyExecution}
                                    />
                                    <ResourceSection
                                        title="Maquinário (Real)"
                                        resources={formData.actualMachinery || []}
                                        onAdd={(res) => handleResourceChange('actualMachinery', 'add', { resource: res })}
                                        onRemove={(idx) => handleResourceChange('actualMachinery', 'remove', { index: idx })}
                                        onUpdate={(idx, res) => handleResourceChange('actualMachinery', 'update', { index: idx, resource: res })}
                                        rolePlaceholder="Tipo de máquina"
                                        disabled={!formData.actualStartDate || isReadOnlyExecution}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label htmlFor="observations" className="block text-sm font-medium text-brand-med-gray">Observações da Produção</label>
                                        <button
                                            type="button"
                                            onClick={() => canUseAI ? handleAIAssist() : alert('Upgrade necessário para usar IA.')}
                                            disabled={isAnalyzing || !formData.actualStartDate || isReadOnlyExecution}
                                            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-brand-accent/20 text-brand-accent border border-brand-accent/50 hover:bg-brand-accent/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <SparkleIcon className="w-3.5 h-3.5" />
                                            {isAnalyzing ? 'Analisando...' : 'Gerar Análise com IA'}
                                        </button>
                                    </div>
                                    <textarea name="observations" id="observations" value={formData.observations || ''} onChange={handleChange} rows={3} disabled={isReadOnlyExecution} className="mt-1 block w-full bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent disabled:cursor-not-allowed" placeholder="Anote aqui qualquer ocorrência, problema ou detalhe relevante da execução..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-med-gray">Percentual de Avanço ({formData.progress}%)</label>
                                    <div className="w-full bg-brand-darkest/50 rounded-full h-4 mt-2 border border-brand-darkest">
                                        <div className="bg-brand-accent h-full rounded-full transition-all duration-300" style={{ width: `${formData.progress}%` }}></div>
                                    </div>
                                    <p className="text-xs text-brand-med-gray mt-1 h-4">{getProgressHelpText()}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-med-gray">Fotos da Execução</label>
                                    <div className="mt-2">
                                        <label htmlFor="photo-upload" className={`w-full p-6 border-2 border-dashed rounded-md flex flex-col items-center justify-center transition-colors border-brand-med-gray/50 text-brand-med-gray bg-brand-darkest/50 ${isReadOnlyExecution ? 'cursor-not-allowed' : 'cursor-pointer hover:border-brand-accent hover:text-brand-accent'}`}>
                                            <PlusIcon className="w-8 h-8 mb-2" />
                                            <span className="font-semibold text-center">Adicionar Fotos</span>
                                        </label>
                                        <input id="photo-upload" name="photo-upload" type="file" className="sr-only" accept="image/*" multiple onChange={handlePhotoUpload} disabled={isReadOnlyExecution} />
                                    </div>
                                    {formData.photos && formData.photos.length > 0 && (
                                        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                            {formData.photos.map((photo, index) => (
                                                <div key={index} className="relative group">
                                                    <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-24 object-cover rounded-md border-2 border-brand-darkest" />
                                                    {!isReadOnlyExecution && (
                                                        <>
                                                            <button type="button" onClick={() => handleRemovePhoto(index)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500" title="Remover foto">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => canUseAI ? handleAnalyzeSafety(photo, index) : alert('Upgrade necessário para usar IA.')}
                                                                disabled={analyzingPhotoIndex !== null}
                                                                className="absolute bottom-1 left-1 bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-wait"
                                                                title="Analisar Segurança com IA"
                                                            >
                                                                {analyzingPhotoIndex === index
                                                                    ? <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                                                                    : <SafetyAnalysisIcon className="w-4 h-4" />
                                                                }
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {safetyAnalysisResult.status !== 'idle' && (
                                    <div className={`mt-4 p-3 rounded-lg border ${safetyAnalysisResult.status === 'safe' ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-full ${safetyAnalysisResult.status === 'safe' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                                            <h4 className={`font-bold ${safetyAnalysisResult.status === 'safe' ? 'text-green-400' : 'text-red-400'}`}>
                                                {safetyAnalysisResult.status === 'safe' ? 'Análise Segura' : 'Alerta de Risco Detectado'}
                                            </h4>
                                        </div>
                                        <p className="text-sm text-gray-300 mt-2 ml-7 whitespace-pre-wrap">{safetyAnalysisResult.message}</p>
                                    </div>
                                )}

                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-brand-med-gray/30 text-gray-100 rounded-md hover:bg-brand-med-gray/50 transition">Cancelar</button>
                            <button type="submit" disabled={isManager} className="px-4 py-2 bg-brand-accent text-white rounded-md hover:bg-orange-600 transition shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 disabled:bg-gray-500 disabled:cursor-not-allowed">Salvar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TaskModal;