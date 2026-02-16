import React, { useState } from 'react';
import { Task } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useData } from '../context/DataProvider';
import XIcon from './icons/XIcon';
import SparkleIcon from './icons/SparkleIcon';
import AIRestrictedAccess from './AIRestrictedAccess';

interface RdoModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    onUpgradeClick: () => void;
}

const RdoModal: React.FC<RdoModalProps> = ({ isOpen, onClose, tasks, onUpgradeClick }) => {
    const { currentUser: user } = useData();
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [generatedReport, setGeneratedReport] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [copySuccess, setCopySuccess] = useState('');

    if (!isOpen) return null;

    const handleGenerate = async () => {
        const canUseAI = user?.role === 'Master' || user?.role === 'Gerenciador';
        if (!canUseAI) {
            setGeneratedReport(''); // Clear any previous report
            return;
        }
        setIsGenerating(true);
        setGeneratedReport('');
        setError('');
        setCopySuccess('');

        const selectedDate = new Date(reportDate + 'T00:00:00');

        const activeTasks = tasks.filter(task => {
            if (!task.actualStartDate) return false;

            const startDate = new Date(task.actualStartDate + 'T00:00:00');
            // If there's an end date, use it. Otherwise, assume it's ongoing up to "today".
            const endDate = task.actualEndDate ? new Date(task.actualEndDate + 'T00:00:00') : new Date();
            endDate.setHours(23, 59, 59, 999); // Ensure the end date is inclusive

            return selectedDate >= startDate && selectedDate <= endDate;
        });

        if (activeTasks.length === 0) {
            setGeneratedReport("Nenhuma atividade de produção encontrada para a data selecionada.");
            setIsGenerating(false);
            return;
        }

        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const tasksDetails = activeTasks.map(task => `
- Tarefa: ${task.title}
  - Local: ${task.location || 'N/A'} ${task.support ? `(${task.support})` : ''} ${task.corte ? `(${task.corte})` : ''}
  - Responsável: ${task.assignee}
  - Status do Dia: A tarefa estava '${task.status}' com ${task.progress}% de avanço geral.
  - Mão de Obra Alocada no Dia: ${task.actualManpower?.map(r => `${r.quantity} ${r.role}`).join(', ') || 'N/A'}
  - Equipamentos Utilizados no Dia: ${task.actualMachinery?.map(r => `${r.quantity} ${r.role}`).join(', ') || 'N/A'}
  - Observações Relevantes da Tarefa: ${task.observations || 'Nenhuma'}
        `).join('');

            const prompt = `
            Aja como um Engenheiro Civil Sênior responsável por uma obra. Sua tarefa é redigir um Relatório Diário de Obra (RDO) formal, técnico e conciso para a data de ${selectedDate.toLocaleDateString('pt-BR')}.

            Com base na lista de atividades em andamento fornecida abaixo, elabore o RDO seguindo estritamente a seguinte estrutura:

            1.  **CABEÇALHO:**
                - RELATÓRIO DIÁRIO DE OBRA (RDO)
                - Data: ${selectedDate.toLocaleDateString('pt-BR')}
                - Obra: Obras de Infraestrutura Viária
                - Local: PARACAMBI-RJ

            2.  **CONDIÇÕES CLIMÁTICAS:**
                - Descreva brevemente as condições do tempo do dia (ex: "Dia ensolarado com temperaturas amenas, favorável para a execução dos serviços." ou "Manhã com chuvas intermitentes, impactando serviços a céu aberto."). Use "Condições climáticas favoráveis, sem registro de chuvas" como padrão.

            3.  **ATIVIDADES EXECUTADAS:**
                - Para cada tarefa listada nos dados, crie um item descrevendo o serviço realizado no dia. Seja direto e use terminologia técnica da construção civil. Exemplo: "Executada a concretagem dos blocos de fundação no local S01." ou "Prosseguiu-se com o serviço de terraplenagem na frente FT01A.".

            4.  **MÃO DE OBRA E EQUIPAMENTOS:**
                - Compile uma lista consolidada de toda a mão de obra e todos os equipamentos que estavam ativos no dia, com base nos dados de todas as tarefas. Some as quantidades se o mesmo recurso aparecer em mais de uma tarefa.

            5.  **OBSERVAÇÕES GERAIS:**
                - Crie um parágrafo final com observações gerais, como "Os trabalhos seguiram conforme o planejamento, sem registro de acidentes ou intercorrências notáveis." ou mencione algum ponto de atenção se as observações das tarefas indicarem problemas ou atrasos.

            **Dados das Atividades do Dia:**
            ${tasksDetails}

            Formate o relatório de maneira clara e profissional, utilizando tópicos e linguagem formal.
        `;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            setGeneratedReport(text);

        } catch (err) {
            setError("Ocorreu um erro ao gerar o relatório com a IA: " + (err instanceof Error ? err.message : String(err)));
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!generatedReport) return;
        navigator.clipboard.writeText(generatedReport).then(() => {
            setCopySuccess('Copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            ></div>

            <div className="relative bg-[#0a0f18]/90 backdrop-blur-xl w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 bg-gradient-to-r from-brand-accent/10 via-transparent to-transparent flex items-center justify-between shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20 shadow-inner">
                            <SparkleIcon className="w-5 h-5 text-brand-accent animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-wide">Gerador de RDO</h2>
                            <p className="text-[10px] text-brand-accent/80 font-mono uppercase tracking-widest flex items-center gap-2">
                                Powered by AI <span className="w-1 h-1 bg-brand-accent rounded-full animate-blink"></span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="relative z-10 p-2 rounded-full hover:bg-white/5 text-gray-500 hover:text-white transition-colors group"
                    >
                        <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-brand-accent/50 scrollbar-track-transparent">
                    {/* Controls */}
                    <div className="bg-[#111827]/60 p-5 rounded-xl border border-white/5 flex flex-col sm:flex-row items-end gap-4 shadow-sm">
                        <div className="flex-1 w-full space-y-2">
                            <label htmlFor="reportDate" className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Data de Referência
                            </label>
                            <input
                                type="date"
                                id="reportDate"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="w-full bg-[#0a0f18] text-white rounded-xl px-4 py-3 border border-white/10 focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 outline-none transition-all shadow-inner font-mono text-sm"
                            />
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden relative group ${isGenerating
                                ? 'bg-brand-accent/50 cursor-not-allowed'
                                : 'bg-brand-accent hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] shadow-brand-accent/20'
                                }`}
                        >
                            {isGenerating && (
                                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite] skew-x-12"></div>
                            )}
                            {isGenerating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span className="text-sm">Processando...</span>
                                </>
                            ) : (
                                <>
                                    <SparkleIcon className="w-4 h-4 group-hover:animate-pulse" />
                                    <span className="text-sm">Gerar RDO</span>
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3 animate-fade-in shadow-sm">
                            <div className="p-1 bg-red-500/20 rounded-full mt-0.5">
                                <XIcon className="w-3 h-3" />
                            </div>
                            <span className="leading-relaxed">{error}</span>
                        </div>
                    )}

                    <div className="relative group min-h-[300px] flex flex-col">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Relatório Gerado</label>
                            {generatedReport && (
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent text-[10px] font-bold uppercase tracking-wider rounded-lg border border-brand-accent/20 transition-all backdrop-blur-md hover:border-brand-accent/40"
                                >
                                    <span className={copySuccess ? 'text-green-400' : ''}>
                                        {copySuccess ? 'Copiado!' : 'Copiar Texto'}
                                    </span>
                                </button>
                            )}
                        </div>

                        <div className="relative flex-1 min-h-[320px] flex flex-col">
                            {!(user?.role === 'Master' || user?.role === 'Gerenciador') ? (
                                <div className="bg-[#05080f] rounded-xl flex items-center justify-center border border-white/5 p-4 flex-1">
                                    <AIRestrictedAccess
                                        featureName="Gerador de RDO IA"
                                        onUpgradeClick={() => {
                                            onClose();
                                            onUpgradeClick();
                                        }}
                                        description="O Gerador de RDO utiliza inteligência artificial para consolidar todas as atividades do dia em um documento técnico e formal. Disponível para Gerenciador e Master."
                                    />
                                </div>
                            ) : (
                                <>
                                    {isGenerating && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f18]/80 backdrop-blur-[1px] rounded-xl z-20 border border-white/5">
                                            <div className="relative mb-4">
                                                <div className="absolute inset-0 bg-brand-accent blur-xl opacity-20 animate-pulse"></div>
                                                <div className="w-12 h-12 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                            <p className="text-sm text-brand-med-gray font-mono animate-pulse">Analisando dados da obra...</p>
                                        </div>
                                    )}

                                    <textarea
                                        value={generatedReport}
                                        readOnly
                                        placeholder="O relatório detalhado gerado pela IA aparecerá aqui..."
                                        className="w-full h-full min-h-[320px] bg-[#05080f] text-gray-300 rounded-xl p-5 border border-white/5 focus:border-brand-accent/30 focus:outline-none resize-none font-mono text-xs sm:text-sm leading-relaxed shadow-inner scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-brand-accent/30"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                {generatedReport && !isGenerating && (
                    <div className="p-4 border-t border-white/5 bg-[#05080f]/50 flex justify-end gap-3 backdrop-blur-sm">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-400 hover:text-white text-sm font-bold transition-colors"
                        >
                            Fechar
                        </button>
                        <button
                            onClick={handleCopy}
                            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-sm font-bold transition-all shadow-sm hover:shadow-md"
                        >
                            {copySuccess || 'Copiar Relatório'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RdoModal;