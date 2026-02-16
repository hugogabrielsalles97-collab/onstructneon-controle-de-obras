import React, { useMemo, useState } from 'react';
import { Restriction, RestrictionStatus, RestrictionPriority, RestrictionType, Task } from '../types';
import Header from './Header';
import { User } from '../types';
import Sidebar from './Sidebar';
import ClearIcon from './icons/ClearIcon';
import CheckIcon from './icons/CheckIcon';
import LightbulbIcon from './icons/LightbulbIcon';
import SparkleIcon from './icons/SparkleIcon';
import XIcon from './icons/XIcon';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ConfirmModal from './ConfirmModal';
import RestrictionsRadarChart from './RestrictionsRadarChart';
import AIRestrictedAccess from './AIRestrictedAccess';

interface RestrictionsAnalysisPageProps {
    user: User;
    restrictions: Restriction[];
    baselineTasks: any[];
    onLogout: () => void;
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
    onUpdateRestriction: (id: string, updates: Partial<Restriction>) => Promise<void>;
    onDeleteRestriction: (id: string) => Promise<void>;
    onUpgradeClick: () => void;
}

const RestrictionsAnalysisPage: React.FC<RestrictionsAnalysisPageProps> = ({
    user,
    restrictions,
    baselineTasks,
    onLogout,
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToWarRoom,
    onNavigateToPodcast,
    onNavigateToCost,
    onNavigateToHome,
    onUpdateRestriction,
    onDeleteRestriction,
    onUpgradeClick
}) => {
    const [filterStatuses, setFilterStatuses] = useState<RestrictionStatus[]>(Object.values(RestrictionStatus));
    const [filterType, setFilterType] = useState<RestrictionType | 'all'>('all');
    const [filterPriority, setFilterPriority] = useState<RestrictionPriority | 'all'>('all');
    const [filterDepartment, setFilterDepartment] = useState<string>('all');
    const [filterImpacted, setFilterImpacted] = useState(false);
    const [selectedRestriction, setSelectedRestriction] = useState<Restriction | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [actionType, setActionType] = useState<'start' | 'resolve' | null>(null);
    const [actionDate, setActionDate] = useState('');
    const [filterLookahead, setFilterLookahead] = useState<'all' | '4weeks' | '12weeks'>('all');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
    const [isDeleting, setIsDeleting] = useState(false);

    // Análise de restrições
    const analysis = useMemo(() => {
        const total = restrictions.length;
        const pending = restrictions.filter(r => r.status === RestrictionStatus.Pending).length;
        const inProgress = restrictions.filter(r => r.status === RestrictionStatus.InProgress).length;
        const resolved = restrictions.filter(r => r.status === RestrictionStatus.Resolved).length;

        const critical = restrictions.filter(r => r.priority === RestrictionPriority.Critical && r.status !== RestrictionStatus.Resolved).length;
        const high = restrictions.filter(r => r.priority === RestrictionPriority.High && r.status !== RestrictionStatus.Resolved).length;

        // Restrições por tipo
        const byType = Object.values(RestrictionType).map(type => ({
            type,
            count: restrictions.filter(r => r.type === type && r.status !== RestrictionStatus.Resolved).length
        })).filter(item => item.count > 0);

        // Taxa de resolução
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        // Restrições impactantes (Prazo > (Início da Tarefa - 2 dias))
        const impacted = restrictions.filter(r => {
            if (!r.due_date || r.status === RestrictionStatus.Resolved) return false;
            const task = baselineTasks.find(t => String(t.id) === String(r.baseline_task_id));
            if (!task) return false;

            const startDate = new Date(task.startDate);
            const impactLimit = new Date(startDate);
            impactLimit.setDate(startDate.getDate() - 2);

            return new Date(r.due_date) > impactLimit;
        }).length;

        // Setores únicos para o filtro
        const departments = Array.from(new Set(restrictions.map(r => r.department).filter(Boolean))) as string[];

        return {
            total,
            pending,
            inProgress,
            resolved,
            critical,
            high,
            byType,
            resolutionRate,
            impacted,
            departments
        };
    }, [restrictions, baselineTasks]);

    // Filtrar restrições
    const filteredRestrictions = useMemo(() => {
        return restrictions.filter(r => {
            const matchStatus = filterStatuses.length === 0 || filterStatuses.includes(r.status as RestrictionStatus);
            const matchType = filterType === 'all' || r.type === filterType;
            const matchPriority = filterPriority === 'all' || r.priority === filterPriority;
            const matchDepartment = filterDepartment === 'all' || r.department === filterDepartment;

            // Filtro de Lookahead
            let matchLookahead = true;
            if (filterLookahead !== 'all') {
                const task = baselineTasks.find(t => String(t.id) === String(r.baseline_task_id));
                if (task) {
                    const taskStart = new Date(task.startDate);
                    const today = new Date();
                    const weeks = filterLookahead === '4weeks' ? 4 : 12;
                    const horizon = new Date();
                    horizon.setDate(today.getDate() + (weeks * 7));

                    if (taskStart > horizon) matchLookahead = false;
                }
            }

            const matchImpacted = !filterImpacted || (
                r.due_date &&
                r.status !== RestrictionStatus.Resolved &&
                (() => {
                    const task = baselineTasks.find(t => String(t.id) === String(r.baseline_task_id));
                    if (!task) return false;
                    const startDate = new Date(task.startDate);
                    const impactLimit = new Date(startDate);
                    impactLimit.setDate(startDate.getDate() - 2);
                    return new Date(r.due_date!) > impactLimit;
                })() // Removido '!' extra que poderia dar erro se due_date for undefined mas checado antes
            );

            return matchStatus && matchType && matchPriority && matchDepartment && matchImpacted && matchLookahead;
        });
    }, [restrictions, filterStatuses, filterType, filterPriority, filterDepartment, filterImpacted, filterLookahead, baselineTasks]);

    const getTaskDetails = (baselineTaskId: string) => {
        const task = baselineTasks.find(t => String(t.id) === String(baselineTaskId));
        return task || null;
    };

    const getPriorityColor = (priority: RestrictionPriority) => {
        switch (priority) {
            case RestrictionPriority.Critical: return 'bg-red-500/20 text-red-400 border-red-500/30';
            case RestrictionPriority.High: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case RestrictionPriority.Medium: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case RestrictionPriority.Low: return 'bg-green-500/20 text-green-400 border-green-500/30';
        }
    };

    const getStatusColor = (status: RestrictionStatus) => {
        switch (status) {
            case RestrictionStatus.Pending: return 'bg-red-500/20 text-red-400 border-red-500/30';
            case RestrictionStatus.InProgress: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case RestrictionStatus.Resolved: return 'bg-green-500/20 text-green-400 border-green-500/30';
        }
    };

    const openActionModal = (restriction: Restriction, type: 'start' | 'resolve') => {
        setSelectedRestriction(restriction);
        setActionType(type);
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setActionDate(now.toISOString().slice(0, 16));
        setResolutionNotes('');
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirmAction = async () => {
        if (!selectedRestriction || !actionType || isSubmitting) return;

        if (actionType === 'resolve' && !resolutionNotes.trim()) {
            alert('Por favor, adicione notas de resolução');
            return;
        }

        setIsSubmitting(true);
        try {
            const updates: Partial<Restriction> = {};

            if (actionType === 'start') {
                updates.status = RestrictionStatus.InProgress;
                updates.actual_start_date = new Date(actionDate).toISOString();
            } else {
                updates.status = RestrictionStatus.Resolved;
                updates.resolved_at = new Date(actionDate).toISOString();
                updates.actual_completion_date = new Date(actionDate).toISOString();
                updates.resolution_notes = resolutionNotes;
            }

            await onUpdateRestriction(selectedRestriction.id, updates);

            setSelectedRestriction(null);
            setActionType(null);
            setResolutionNotes('');
            setActionDate('');
        } catch (error) {
            console.error('Erro ao salvar ação:', error);
            alert('Erro ao salvar as alterações da restrição.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateAI = async () => {
        const canUseAI = user.role === 'Master' || user.role === 'Gerenciador';
        if (!canUseAI) {
            setShowAIModal(true);
            setAiInsight(null);
            setIsGeneratingAI(false);
            return;
        }
        setIsGeneratingAI(true);
        setShowAIModal(true);
        setAiInsight(null);

        try {
            const apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY;
            if (!apiKey) throw new Error('API Key da IA não configurada (.env)');

            const genAI = new GoogleGenerativeAI(apiKey);

            // Preparar dados para a IA
            const activeRestrictions = restrictions.filter(r => r.status !== RestrictionStatus.Resolved);
            const restrictionsData = activeRestrictions.map(r => {
                const task = baselineTasks.find(t => String(t.id) === String(r.baseline_task_id));
                return {
                    id: r.id,
                    tipo: r.type,
                    descricao: r.description,
                    prioridade: r.priority,
                    responsavel: r.responsible,
                    setor: r.department,
                    prazo: r.due_date,
                    tarefa_impactada: task ? task.title : 'N/A',
                    inicio_tarefa: task ? task.startDate : 'N/A'
                };
            });

            const prompt = `
                Você é um consultor especialista em Lean Construction integrado ao sistema 'Lean Solution'.
                Sua tarefa é analisar as restrições ativas da obra e fornecer um resumo geral e sugestões de tomada de decisão estratégica.

                **Dados Atuais (Restrições Ativas):**
                ${JSON.stringify(restrictionsData, null, 2)}

                **Métricas:**
                - Total Ativas: ${activeRestrictions.length}
                - Críticas: ${analysis.critical}
                - Alta Prioridade: ${analysis.high}
                - Restrições Impactantes (Prazo curto): ${analysis.impacted}

                **Instruções de Resposta:**
                1. Comece com um **Resumo Geral** da situação atual (Saúde do fluxo de trabalho).
                2. Identifique os **Gargalos Críticos** (quais restrições ou setores estão mais travando a obra).
                3. Forneça **Sugestões de Tomada de Decisão** práticas (ex: realocação de recursos, cobrança de fornecedores específicos, antecipação de compras).
                4. Use um tom profissional e direto ao ponto.
                5. Use Markdown para formatar a resposta (títulos, listas, negrito).

                Responda em Português do Brasil.
            `;

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            setAiInsight(response.text());
        } catch (error: any) {
            console.error('Erro na IA:', error);
            setAiInsight(`Erro ao gerar insights: ${error.message}. Verifique a configuração da API Key.`);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteConfirm({ isOpen: true, id });
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm.id) return;
        setIsDeleting(true);
        await onDeleteRestriction(deleteConfirm.id);
        setIsDeleting(false);
        setDeleteConfirm({ isOpen: false, id: null });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="analysis"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={() => { }}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToPodcast={onNavigateToPodcast}
                onUpgradeClick={onUpgradeClick}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    user={user}
                    onLogout={onLogout}
                    onNavigateToHome={onNavigateToHome}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToReports={onNavigateToReports}
                    onNavigateToBaseline={onNavigateToBaseline}
                    onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={onNavigateToAnalysis}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="analysis"
                />

                {analysis.impacted > 0 && (
                    <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-3 animate-pulse font-black text-sm uppercase tracking-widest z-20">
                        <span>⚠️ {analysis.impacted} RESTRIÇÕES COM PRAZO IMPACTANDO O INÍCIO DAS ATIVIDADES</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 animate-slide-up animate-stagger-2">
                    <div className="max-w-screen-2xl mx-auto space-y-8">
                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">Análise de Restrições</h2>
                                <p className="text-sm text-brand-med-gray mt-1">Gestão completa de restrições do Last Planner System</p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleGenerateAI}
                                    className="px-6 py-3 bg-brand-accent/20 text-brand-accent rounded-xl hover:bg-brand-accent hover:text-white transition-all duration-300 font-bold border border-brand-accent/30 flex items-center gap-2 group"
                                >
                                    <SparkleIcon className="w-5 h-5 group-hover:animate-pulse" />
                                    Gerar Insights com IA
                                </button>
                                <button
                                    onClick={onNavigateToLean}
                                    className="px-6 py-3 bg-brand-dark/50 text-brand-med-gray rounded-xl hover:bg-brand-accent hover:text-white transition-all duration-300 font-bold border border-white/5"
                                >
                                    ← Voltar ao Lean
                                </button>
                            </div>
                        </div>

                        {/* KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-[#111827] p-6 rounded-2xl border border-white/5">
                                <p className="text-xs font-black text-brand-med-gray uppercase tracking-widest mb-2">Total</p>
                                <p className="text-4xl font-black text-white">{analysis.total}</p>
                                <p className="text-xs text-brand-med-gray mt-2">Restrições cadastradas</p>
                            </div>
                            <div className="bg-[#111827] p-6 rounded-2xl border border-white/5">
                                <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">Pendentes</p>
                                <p className="text-4xl font-black text-red-400">{analysis.pending}</p>
                                <p className="text-xs text-brand-med-gray mt-2">Aguardando ação</p>
                            </div>
                            <div className="bg-[#111827] p-6 rounded-2xl border border-white/5">
                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">Em Resolução</p>
                                <p className="text-4xl font-black text-blue-400">{analysis.inProgress}</p>
                                <p className="text-xs text-brand-med-gray mt-2">Sendo tratadas</p>
                            </div>
                            <div className="bg-[#111827] p-6 rounded-2xl border border-white/5">
                                <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">Resolvidas</p>
                                <p className="text-4xl font-black text-green-400">{analysis.resolved}</p>
                                <p className="text-xs text-brand-med-gray mt-2">Concluídas</p>
                            </div>
                            <div className="bg-[#111827] p-6 rounded-2xl border border-white/5">
                                <p className="text-xs font-black text-brand-accent uppercase tracking-widest mb-2">Taxa de Resolução</p>
                                <p className="text-4xl font-black text-brand-accent">{analysis.resolutionRate}%</p>
                                <p className="text-xs text-brand-med-gray mt-2">Eficiência</p>
                            </div>
                        </div>

                        {/* Alertas Críticos */}
                        {/* Alertas Críticos (Novo Design) */}
                        {analysis.impacted > 0 && (
                            <div className="bg-[#1f1212] border border-red-900/50 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-red-900/10 relative overflow-hidden group">
                                <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-600"></div>

                                <div className="flex-1 z-10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-orange-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                        <h3 className="text-lg font-bold text-red-400">Atenção Requerida</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-6 text-sm text-gray-400 pl-9">
                                        <p>
                                            <span className="text-white font-bold">{analysis.impacted}</span> restrições impactando o início de atividades no cronograma
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setFilterImpacted(!filterImpacted)}
                                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all z-10 ${filterImpacted
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                        }`}
                                >
                                    {filterImpacted ? 'Mostrar Todas' : 'Ver Impactos'}
                                </button>
                            </div>
                        )}

                        {/* Distribuição por Tipo e Radar de Impacto */}
                        {analysis.byType.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                                {/* Cards de Distribuição */}
                                <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 flex flex-col">
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Restrições Ativas por Tipo</h3>
                                    <div className="grid grid-cols-2 gap-3 flex-1 content-start">
                                        {analysis.byType.map(item => (
                                            <div key={item.type} className="bg-brand-dark/50 p-4 rounded-xl border border-white/5 hover:bg-brand-dark transition-colors group">
                                                <p className="text-xs text-brand-med-gray mb-1 group-hover:text-white transition-colors uppercase font-bold tracking-wider">{item.type}</p>
                                                <p className="text-3xl font-black text-white group-hover:text-brand-accent transition-colors">{item.count}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Radar Chart */}
                                <RestrictionsRadarChart restrictions={restrictions} />
                            </div>
                        )}

                        {/* Área de Filtros Avançados */}
                        <div className="bg-[#111827] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                            <div className="p-1 bg-gradient-to-r from-brand-accent/20 via-transparent to-transparent"></div>
                            <div className="p-6">
                                {/* Header do Filtro */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-8 bg-brand-accent rounded-full"></div>
                                        <div>
                                            <h3 className="text-lg font-black text-white tracking-tight">FILTROS DE ANÁLISE</h3>
                                            <p className="text-xs text-brand-med-gray font-medium uppercase tracking-widest">Lookahead & Restrições</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setFilterStatuses(Object.values(RestrictionStatus));
                                            setFilterType('all');
                                            setFilterPriority('all');
                                            setFilterDepartment('all');
                                            setFilterLookahead('all');
                                            setFilterImpacted(false);
                                        }}
                                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-brand-med-gray hover:text-white text-xs font-bold transition-all flex items-center gap-2 border border-white/5"
                                    >
                                        <XIcon className="w-4 h-4" />
                                        Limpar Filtros
                                    </button>
                                </div>

                                {/* Grid de Inputs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                                    {/* Filtro Horizon/Lookahead */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest px-1">Período (Lookahead)</label>
                                        <div className="relative group">
                                            <select
                                                value={filterLookahead}
                                                onChange={(e) => setFilterLookahead(e.target.value as any)}
                                                className="w-full bg-[#0a0f18] text-white text-sm font-bold border border-white/10 rounded-xl px-4 py-3 appearance-none focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent/50 transition-all cursor-pointer"
                                            >
                                                <option value="all">Todas as Datas</option>
                                                <option value="4weeks">Próximas 4 Semanas</option>
                                                <option value="12weeks">Próximas 12 Semanas</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-med-gray group-hover:text-white transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filtro Tipo */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest px-1">Disciplina / Tipo</label>
                                        <div className="relative group">
                                            <select
                                                value={filterType}
                                                onChange={(e) => setFilterType(e.target.value as any)}
                                                className="w-full bg-[#0a0f18] text-white text-sm font-bold border border-white/10 rounded-xl px-4 py-3 appearance-none focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent/50 transition-all cursor-pointer"
                                            >
                                                <option value="all">Todas as Disciplinas</option>
                                                {Object.values(RestrictionType).map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-med-gray group-hover:text-white transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filtro Setor */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest px-1">Frente / Setor</label>
                                        <div className="relative group">
                                            <select
                                                value={filterDepartment}
                                                onChange={(e) => setFilterDepartment(e.target.value)}
                                                className="w-full bg-[#0a0f18] text-white text-sm font-bold border border-white/10 rounded-xl px-4 py-3 appearance-none focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent/50 transition-all cursor-pointer"
                                            >
                                                <option value="all">Todos os Setores</option>
                                                {analysis.departments.map(dept => (
                                                    <option key={dept} value={dept}>{dept}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-med-gray group-hover:text-white transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filtro Prioridade */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest px-1">Prioridade</label>
                                        <div className="relative group">
                                            <select
                                                value={filterPriority}
                                                onChange={(e) => setFilterPriority(e.target.value as any)}
                                                className="w-full bg-[#0a0f18] text-white text-sm font-bold border border-white/10 rounded-xl px-4 py-3 appearance-none focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent/50 transition-all cursor-pointer"
                                            >
                                                <option value="all">Todas</option>
                                                {Object.values(RestrictionPriority).map(priority => (
                                                    <option key={priority} value={priority}>{priority}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-med-gray group-hover:text-white transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                {/* Barra de Status (Abaixo dos Filters) */}
                                <div className="mt-6 pt-6 border-t border-white/5">
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest">Filtrar por Status:</label>
                                        <div className="flex flex-wrap gap-2 p-1 bg-[#0a0f18] rounded-lg border border-white/5">
                                            {[
                                                { label: 'Todas', value: 'all', color: 'text-white' },
                                                { label: 'Pendentes', value: RestrictionStatus.Pending, color: 'text-red-400' },
                                                { label: 'Em Andamento', value: RestrictionStatus.InProgress, color: 'text-blue-400' },
                                                { label: 'Resolvidas', value: RestrictionStatus.Resolved, color: 'text-green-400' }
                                            ].map((statusOpt) => {
                                                const isActive = statusOpt.value === 'all'
                                                    ? filterStatuses.length === Object.values(RestrictionStatus).length
                                                    : filterStatuses.includes(statusOpt.value as RestrictionStatus) && filterStatuses.length !== Object.values(RestrictionStatus).length;

                                                return (
                                                    <button
                                                        key={statusOpt.label}
                                                        onClick={() => {
                                                            const allStatuses = Object.values(RestrictionStatus);

                                                            if (statusOpt.value === 'all') {
                                                                setFilterStatuses(allStatuses);
                                                            } else {
                                                                const status = statusOpt.value as RestrictionStatus;

                                                                // Se "Todas" está selecionado (length == total), clicar num item inicia seleção exclusiva desse item
                                                                if (filterStatuses.length === allStatuses.length) {
                                                                    setFilterStatuses([status]);
                                                                } else {
                                                                    // Toggle seleção
                                                                    if (filterStatuses.includes(status)) {
                                                                        const newStatuses = filterStatuses.filter(s => s !== status);
                                                                        // Se remover o último, volta para todas
                                                                        if (newStatuses.length === 0) {
                                                                            setFilterStatuses(allStatuses);
                                                                        } else {
                                                                            setFilterStatuses(newStatuses);
                                                                        }
                                                                    } else {
                                                                        // Adicionar seleção
                                                                        setFilterStatuses([...filterStatuses, status]);
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${isActive
                                                            ? 'bg-[#1c2333] shadow-lg border border-white/10 ' + statusOpt.color
                                                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                                                            }`}
                                                    >
                                                        {statusOpt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Lista de Restrições */}
                        <div className="space-y-3">
                            {filteredRestrictions.length === 0 ? (
                                <div className="bg-[#111827] p-12 rounded-2xl border border-white/5 text-center">
                                    <p className="text-brand-med-gray">Nenhuma restrição encontrada com os filtros selecionados.</p>
                                </div>
                            ) : (
                                filteredRestrictions.map(restriction => (
                                    <div
                                        key={restriction.id}
                                        className="bg-[#111827] border border-white/5 rounded-xl p-5 hover:border-brand-accent/30 transition-all"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-black uppercase border ${getPriorityColor(restriction.priority)}`}>
                                                        {restriction.priority}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-black uppercase border ${getStatusColor(restriction.status)}`}>
                                                        {restriction.status}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-lg text-xs font-bold uppercase bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
                                                        {restriction.type}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-bold text-white mb-1">
                                                    Atividade: {getTaskDetails(restriction.baseline_task_id)?.title || 'Tarefa não encontrada'}
                                                    {(() => {
                                                        const task = getTaskDetails(restriction.baseline_task_id);
                                                        if (task && task.level && task.level !== '-') {
                                                            return <span className="text-brand-accent ml-2 text-xs font-black uppercase">[{task.level}]</span>;
                                                        }
                                                        return null;
                                                    })()}
                                                </h4>
                                                <p className="text-sm text-gray-300 mb-3">{restriction.description}</p>
                                                <div className="flex flex-wrap gap-4 text-xs text-brand-med-gray">
                                                    <span>Responsável: <span className="text-white font-bold">{restriction.responsible}</span></span>
                                                    {restriction.department && (
                                                        <span>Setor: <span className="text-brand-accent font-bold uppercase">{restriction.department}</span></span>
                                                    )}
                                                    {restriction.due_date && (
                                                        <span className={`${(() => {
                                                            const task = baselineTasks.find(t => String(t.id) === String(restriction.baseline_task_id));
                                                            if (task && restriction.status !== RestrictionStatus.Resolved) {
                                                                const startDate = new Date(task.startDate);
                                                                const impactLimit = new Date(startDate);
                                                                impactLimit.setDate(startDate.getDate() - 2);

                                                                if (new Date(restriction.due_date!) > impactLimit) {
                                                                    return 'text-red-400 font-bold animate-pulse';
                                                                }
                                                            }
                                                            return 'text-white font-bold';
                                                        })()}`}>
                                                            Previsão Conclusão: {new Date(restriction.due_date).toLocaleDateString('pt-BR')}
                                                            {(() => {
                                                                const task = baselineTasks.find(t => String(t.id) === String(restriction.baseline_task_id));
                                                                if (task && restriction.status !== RestrictionStatus.Resolved) {
                                                                    const startDate = new Date(task.startDate);
                                                                    const impactLimit = new Date(startDate);
                                                                    impactLimit.setDate(startDate.getDate() - 2);

                                                                    if (new Date(restriction.due_date!) > impactLimit) {
                                                                        return ` (Impacta Início - Limite: ${impactLimit.toLocaleDateString('pt-BR')})`;
                                                                    }
                                                                }
                                                                return '';
                                                            })()}
                                                        </span>
                                                    )}

                                                    {/* Datas Reais */}
                                                    {restriction.actual_start_date && (
                                                        <span className="text-blue-400">Início Real: {formatDate(restriction.actual_start_date)}</span>
                                                    )}
                                                    {restriction.actual_completion_date && (
                                                        <span className="text-green-400">Término Real: {formatDate(restriction.actual_completion_date)}</span>
                                                    )}

                                                    <span>Criada em: {formatDate(restriction.created_at)}</span>
                                                </div>
                                                {restriction.resolution_notes && (
                                                    <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                                        <p className="text-xs font-bold text-green-400 mb-1">Notas de Resolução:</p>
                                                        <p className="text-xs text-gray-300">{restriction.resolution_notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {restriction.status !== RestrictionStatus.Resolved && (
                                                    <>
                                                        <button
                                                            onClick={() => openActionModal(restriction, 'resolve')}
                                                            className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-bold text-xs border border-green-500/30"
                                                        >
                                                            Resolver
                                                        </button>
                                                        {restriction.status === RestrictionStatus.Pending && (
                                                            <button
                                                                onClick={() => openActionModal(restriction, 'start')}
                                                                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all font-bold text-xs border border-blue-500/30"
                                                            >
                                                                Iniciar
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {(user.role === 'Master' || user.role === 'Planejador') && (
                                                    <button
                                                        onClick={() => handleDeleteClick(restriction.id)}
                                                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-bold text-xs border border-red-500/30"
                                                    >
                                                        Excluir
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                onConfirm={handleConfirmDelete}
                title="Excluir Restrição"
                message="Tem certeza que deseja excluir esta restrição? Esta ação não pode ser desfeita."
                confirmText="Sim, Excluir"
                cancelText="Cancelar"
                type="danger"
                isLoading={isDeleting}
            />

            {/* Modal de Ação (Iniciar / Resolver) - Premium Glass Design */}
            {selectedRestriction && actionType && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
                    {/* Backdrop com desfoque profundo */}
                    <div
                        className="absolute inset-0 bg-[#060a12]/80 backdrop-blur-2xl animate-fade-in"
                        onClick={() => !isSubmitting && (setSelectedRestriction(null), setActionType(null))}
                    ></div>

                    {/* Modal Container Glassmorphism */}
                    <div className="relative w-full max-w-lg bg-[#0a0f18]/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(227,90,16,0.15)] overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">

                        {/* Brand Accent Glow */}
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent ${actionType === 'start' ? 'via-blue-500' : 'via-green-500'} to-transparent opacity-50`}></div>

                        {/* Header */}
                        <div className="px-8 py-6 flex justify-between items-start border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl ${actionType === 'start' ? 'bg-blue-500/20 border-blue-500/30' : 'bg-green-500/20 border-green-500/30'} flex items-center justify-center border shadow-lg`}>
                                        {actionType === 'start' ? (
                                            <SparkleIcon className="w-5 h-5 text-blue-400" />
                                        ) : (
                                            <CheckIcon className="w-5 h-5 text-green-400" />
                                        )}
                                    </div>
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                        {actionType === 'start' ? 'Iniciar' : 'Concluir'} <span className={actionType === 'start' ? 'text-blue-400' : 'text-green-400'}>Resolução</span>
                                    </h2>
                                </div>
                                <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                    Atividade: <span className="text-white bg-white/5 px-2 py-0.5 rounded italic">{getTaskDetails(selectedRestriction.baseline_task_id)?.title || 'N/A'}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedRestriction(null);
                                    setActionType(null);
                                }}
                                className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-500 text-brand-med-gray transition-all group"
                            >
                                <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
                            {/* Data/Hora */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">
                                    {actionType === 'start' ? 'Data/Hora Real de Início' : 'Data/Hora Real de Término'}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={actionDate}
                                    onChange={(e) => setActionDate(e.target.value)}
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold"
                                />
                            </div>

                            {actionType === 'resolve' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">
                                        Notas de Resolução
                                    </label>
                                    <textarea
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                        rows={4}
                                        placeholder="Descreva o que foi feito para remover este impedimento..."
                                        className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-black/20 border-t border-white/5 flex gap-4 shrink-0">
                            <button
                                onClick={() => {
                                    setSelectedRestriction(null);
                                    setActionType(null);
                                }}
                                className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                className={`flex-[2] py-4 ${actionType === 'start' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'} text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:-translate-y-1 active:scale-95`}
                            >
                                Confirmar {actionType === 'start' ? 'Início' : 'Conclusão'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Insight IA */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                        onClick={() => !isGeneratingAI && setShowAIModal(false)}
                        aria-hidden="true"
                    ></div>

                    <div className="relative bg-[#0a0f18]/90 backdrop-blur-xl w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                        {/* Header do Modal */}
                        <div className="px-8 py-6 border-b border-white/5 bg-gradient-to-r from-brand-accent/10 via-transparent to-transparent flex items-center justify-between shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20 shadow-inner">
                                    <LightbulbIcon className="w-6 h-6 text-brand-accent animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-wide">Consultoria Lean IA</h3>
                                    <p className="text-xs text-brand-accent/80 font-mono uppercase tracking-widest flex items-center gap-2">
                                        Análise Estratégica <span className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-blink"></span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="relative z-10 p-2.5 rounded-full hover:bg-white/5 text-gray-500 hover:text-white transition-colors group"
                            >
                                <XIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Conteúdo do Insight */}
                        <div className="flex-1 overflow-y-auto p-8 bg-[#0a0f18]/50 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-brand-accent/50 scrollbar-track-transparent">
                            {!(user.role === 'Master' || user.role === 'Gerenciador') ? (
                                <AIRestrictedAccess
                                    featureName="Consultoria Lean IA"
                                    onUpgradeClick={() => {
                                        setShowAIModal(false);
                                        onUpgradeClick();
                                    }}
                                    description="A Consultoria Lean IA analisa todas as restrições ativas, cruzando prazos e responsabilidades para sugerir estratégias de resolução rápida. Disponível para Gerenciador e Master."
                                />
                            ) : isGeneratingAI ? (
                                <div className="flex flex-col items-center justify-center h-80 space-y-8 animate-fade-in">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-brand-accent blur-3xl opacity-20 animate-pulse"></div>
                                        <div className="w-20 h-20 border-4 border-white/10 border-t-brand-accent rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <SparkleIcon className="w-8 h-8 text-brand-accent/80 animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-xl font-bold text-white tracking-tight animate-pulse">Hugo está analisando os dados...</p>
                                        <p className="text-sm text-brand-med-gray font-mono uppercase tracking-wider">Cruzando restrições, prazos e responsabilidades</p>
                                    </div>

                                    {/* Loading Steps Visualization */}
                                    <div className="flex gap-2 mt-4">
                                        <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce delay-0"></div>
                                        <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce delay-150"></div>
                                        <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce delay-300"></div>
                                    </div>
                                </div>
                            ) : aiInsight ? (
                                <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-white prose-strong:text-brand-accent prose-ul:list-disc prose-li:text-gray-300 animate-slide-up">
                                    <div className="bg-[#111827]/40 p-8 rounded-2xl border border-white/5 shadow-inner">
                                        <div className="whitespace-pre-wrap text-gray-200 leading-relaxed space-y-4 font-light text-base">
                                            {aiInsight.split('\n').map((line, i) => {
                                                if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-white mt-8 mb-3 flex items-center gap-2 border-l-4 border-brand-accent pl-3">{line.replace('### ', '')}</h3>;
                                                if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-black text-brand-accent mt-10 mb-6 border-b border-brand-accent/20 pb-4 tracking-tight">{line.replace('## ', '')}</h2>;
                                                if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-black text-white mt-8 mb-6">{line.replace('# ', '')}</h1>;
                                                if (line.startsWith('- ')) return <li key={i} className="ml-4 text-gray-300 pl-2 border-l border-white/10 hover:border-brand-accent/50 transition-colors py-1">{line.replace('- ', '')}</li>;
                                                if (line.trim() === '') return <br key={i} />;

                                                const formattedLine = line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={j} className="text-brand-accent font-bold px-1 bg-brand-accent/5 rounded">{part.slice(2, -2)}</strong>;
                                                    }
                                                    return part;
                                                });

                                                return <p key={i} className="text-gray-300">{formattedLine}</p>;
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                        <LightbulbIcon className="w-8 h-8 text-gray-600" />
                                    </div>
                                    <p className="text-brand-med-gray">Nenhum insight disponível no momento.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-6 border-t border-white/5 bg-[#05080f]/50 flex justify-end backdrop-blur-sm">
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="px-8 py-3 bg-brand-accent text-white rounded-xl font-bold hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-brand-accent/20 flex items-center gap-2 group"
                            >
                                <CheckIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RestrictionsAnalysisPage;
