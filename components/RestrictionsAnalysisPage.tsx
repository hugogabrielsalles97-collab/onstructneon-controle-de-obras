import React, { useMemo, useState } from 'react';
import { Restriction, RestrictionStatus, RestrictionPriority, RestrictionType, Task } from '../types';
import Header from './Header';
import { User } from '../types';
import ClearIcon from './icons/ClearIcon';
import CheckIcon from './icons/CheckIcon';
import LightbulbIcon from './icons/LightbulbIcon';
import SparkleIcon from './icons/SparkleIcon';
import XIcon from './icons/XIcon';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    onUpdateRestriction,
    onDeleteRestriction,
    onUpgradeClick
}) => {
    const [filterStatuses, setFilterStatuses] = useState<RestrictionStatus[]>(Object.values(RestrictionStatus));
    const [filterType, setFilterType] = useState<RestrictionType | 'all'>('all');
    const [filterPriority, setFilterPriority] = useState<RestrictionPriority | 'all'>('all');
    const [filterDepartment, setFilterDepartment] = useState<string>('all');
    const [selectedRestriction, setSelectedRestriction] = useState<Restriction | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);

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
            return matchStatus && matchType && matchPriority && matchDepartment;
        });
    }, [restrictions, filterStatuses, filterType, filterPriority, filterDepartment]);

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

    const handleResolve = async (restriction: Restriction) => {
        if (!resolutionNotes.trim()) {
            alert('Por favor, adicione notas de resolução');
            return;
        }

        await onUpdateRestriction(restriction.id, {
            status: RestrictionStatus.Resolved,
            resolved_at: new Date().toISOString(),
            resolution_notes: resolutionNotes
        });

        setSelectedRestriction(null);
        setResolutionNotes('');
    };

    const handleGenerateAI = async () => {
        const canUseAI = user.role === 'Master' || user.role === 'Gerenciador';
        if (!canUseAI) {
            alert('Upgrade necessário para usar IA.');
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
        <div className="flex flex-col h-screen bg-[#0a0f18]">
            <Header
                user={user}
                onLogout={onLogout}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onUpgradeClick={onUpgradeClick}
                activeScreen="lean"
            />

            {/* Banner de Impacto Crítico */}
            {analysis.impacted > 0 && (
                <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-3 animate-pulse font-black text-sm uppercase tracking-widest">
                    <span>⚠️ {analysis.impacted} RESTRIÇÕES COM PRAZO IMPACTANDO O INÍCIO DAS ATIVIDADES</span>
                </div>
            )}

            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-8">
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
                    {(analysis.critical > 0 || analysis.high > 0 || analysis.impacted > 0) && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                            <h3 className="text-lg font-black text-red-400 mb-3">⚠️ Atenção Requerida</h3>
                            <div className="flex flex-wrap gap-6 text-sm">
                                {analysis.critical > 0 && (
                                    <p className="text-red-300">
                                        <span className="font-black">{analysis.critical}</span> restrições críticas não resolvidas
                                    </p>
                                )}
                                {analysis.impacted > 0 && (
                                    <p className="text-red-400 animate-pulse font-bold">
                                        <span className="font-black">{analysis.impacted}</span> prazos impactando o cronograma
                                    </p>
                                )}
                                {analysis.high > 0 && (
                                    <p className="text-orange-300">
                                        <span className="font-black">{analysis.high}</span> restrições de alta prioridade
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Distribuição por Tipo */}
                    {analysis.byType.length > 0 && (
                        <div className="bg-[#111827] p-6 rounded-2xl border border-white/5">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Restrições Ativas por Tipo</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {analysis.byType.map(item => (
                                    <div key={item.type} className="bg-brand-dark/50 p-3 rounded-lg border border-white/5">
                                        <p className="text-xs text-brand-med-gray mb-1">{item.type}</p>
                                        <p className="text-2xl font-black text-white">{item.count}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-[#111827] p-4 rounded-xl border border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-brand-med-gray uppercase mb-2">Status</label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.values(RestrictionStatus).map(status => {
                                        const isActive = filterStatuses.includes(status);
                                        return (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    setFilterStatuses(prev =>
                                                        prev.includes(status)
                                                            ? prev.filter(s => s !== status)
                                                            : [...prev, status]
                                                    );
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${isActive
                                                        ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/50'
                                                        : 'bg-brand-dark text-brand-med-gray border-white/10 hover:border-white/20'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => {
                                            if (filterStatuses.length === Object.values(RestrictionStatus).length) {
                                                setFilterStatuses([]);
                                            } else {
                                                setFilterStatuses(Object.values(RestrictionStatus));
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${filterStatuses.length === Object.values(RestrictionStatus).length
                                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                                                : 'bg-brand-dark text-brand-med-gray border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        Todos
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-med-gray uppercase mb-2">Tipo</label>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-accent focus:outline-none"
                                >
                                    <option value="all">Todos</option>
                                    {Object.values(RestrictionType).map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-med-gray uppercase mb-2">Prioridade</label>
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value as any)}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-accent focus:outline-none"
                                >
                                    <option value="all">Todas</option>
                                    {Object.values(RestrictionPriority).map(priority => (
                                        <option key={priority} value={priority}>{priority}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-med-gray uppercase mb-2">Setor Responsável</label>
                                <select
                                    value={filterDepartment}
                                    onChange={(e) => setFilterDepartment(e.target.value)}
                                    className="w-full bg-brand-dark border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-accent focus:outline-none"
                                >
                                    <option value="all">Todos os Setores</option>
                                    {analysis.departments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
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
                                                        Prazo Limite: {new Date(restriction.due_date).toLocaleDateString('pt-BR')}
                                                        {(() => {
                                                            const task = baselineTasks.find(t => String(t.id) === String(restriction.baseline_task_id));
                                                            if (task && restriction.status !== RestrictionStatus.Resolved) {
                                                                const startDate = new Date(task.startDate);
                                                                const impactLimit = new Date(startDate);
                                                                impactLimit.setDate(startDate.getDate() - 2);

                                                                if (new Date(restriction.due_date!) > impactLimit) {
                                                                    return ' (Impacta Início)';
                                                                }
                                                            }
                                                            return '';
                                                        })()}
                                                    </span>
                                                )}
                                                <span>Criada em: {formatDate(restriction.created_at)}</span>
                                                {restriction.resolved_at && (
                                                    <span className="text-green-400">Resolvida em: {formatDate(restriction.resolved_at)}</span>
                                                )}
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
                                                        onClick={() => setSelectedRestriction(restriction)}
                                                        className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-bold text-xs border border-green-500/30"
                                                    >
                                                        Resolver
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateRestriction(restriction.id, {
                                                            status: restriction.status === RestrictionStatus.Pending
                                                                ? RestrictionStatus.InProgress
                                                                : RestrictionStatus.Pending
                                                        })}
                                                        className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all font-bold text-xs border border-blue-500/30"
                                                    >
                                                        {restriction.status === RestrictionStatus.Pending ? 'Iniciar' : 'Pausar'}
                                                    </button>
                                                </>
                                            )}
                                            {(user.role === 'Master' || user.role === 'Planejador') && (
                                                <button
                                                    onClick={() => onDeleteRestriction(restriction.id)}
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
            </main>

            {/* Modal de Resolução */}
            {selectedRestriction && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111827] rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full p-6">
                        <h3 className="text-xl font-black text-white mb-4">Resolver Restrição</h3>
                        <p className="text-sm text-brand-med-gray mb-4">
                            Atividade: <span className="text-white font-bold">{getTaskDetails(selectedRestriction.baseline_task_id)?.title || 'N/A'}</span>
                        </p>
                        <p className="text-sm text-gray-300 mb-4">{selectedRestriction.description}</p>
                        <textarea
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            rows={4}
                            placeholder="Descreva como a restrição foi resolvida..."
                            className="w-full bg-brand-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-brand-med-gray focus:border-brand-accent focus:outline-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSelectedRestriction(null);
                                    setResolutionNotes('');
                                }}
                                className="flex-1 px-6 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all font-bold border border-white/10"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleResolve(selectedRestriction)}
                                className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all font-bold"
                            >
                                Marcar como Resolvida
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Insight IA */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isGeneratingAI && setShowAIModal(false)}></div>
                    <div className="relative bg-brand-dark border border-brand-accent/30 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-brand-darkest/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-accent/20 rounded-lg">
                                    <LightbulbIcon className="w-6 h-6 text-brand-accent" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white">Consultoria Lean IA</h3>
                                    <p className="text-xs text-brand-med-gray font-bold uppercase tracking-wider">Análise Estratégica de Restrições</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors text-brand-med-gray hover:text-white"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Conteúdo do Insight */}
                        <div className="flex-1 overflow-y-auto p-8 bg-[#0a0f18]/50">
                            {isGeneratingAI ? (
                                <div className="flex flex-col items-center justify-center h-64 space-y-6">
                                    <div className="relative">
                                        <div className="w-16 h-16 border-4 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <SparkleIcon className="w-6 h-6 text-brand-accent animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-white">Hugo está analisando os dados...</p>
                                        <p className="text-sm text-brand-med-gray mt-1">Cruzando restrições, prazos e responsabilidades.</p>
                                    </div>
                                </div>
                            ) : aiInsight ? (
                                <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-white prose-strong:text-brand-accent prose-ul:list-disc prose-li:text-gray-300">
                                    <div className="whitespace-pre-wrap text-gray-200 leading-relaxed space-y-4">
                                        {aiInsight.split('\n').map((line, i) => {
                                            if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold text-white mt-6 mb-2">{line.replace('### ', '')}</h3>;
                                            if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-black text-brand-accent mt-8 mb-4 border-b border-brand-accent/20 pb-2">{line.replace('## ', '')}</h2>;
                                            if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-black text-white mt-8 mb-6">{line.replace('# ', '')}</h1>;
                                            if (line.startsWith('- ')) return <li key={i} className="ml-4 text-gray-300">{line.replace('- ', '')}</li>;
                                            if (line.trim() === '') return <br key={i} />;

                                            const formattedLine = line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                                                if (part.startsWith('**') && part.endsWith('**')) {
                                                    return <strong key={j} className="text-brand-accent">{part.slice(2, -2)}</strong>;
                                                }
                                                return part;
                                            });

                                            return <p key={i} className="text-gray-300">{formattedLine}</p>;
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-brand-med-gray py-20">
                                    Nenhum insight disponível no momento.
                                </div>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-6 border-t border-white/10 bg-brand-darkest/50 flex justify-end">
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="px-8 py-3 bg-brand-accent text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-brand-accent/20"
                            >
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
