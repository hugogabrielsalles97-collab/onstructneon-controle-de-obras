import React, { useState } from 'react';
import { Task } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useData } from '../context/DataProvider';
import XIcon from './icons/XIcon';
import SparkleIcon from './icons/SparkleIcon';

interface RdoModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
}

const RdoModal: React.FC<RdoModalProps> = ({ isOpen, onClose, tasks }) => {
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
            alert('Upgrade necessário para usar IA.');
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
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div className="bg-brand-dark rounded-lg shadow-2xl shadow-brand-accent/20 border border-brand-accent/30 w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in">
                <div className="p-6 border-b border-brand-accent/20">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-brand-accent">Gerador de RDO com IA</h2>
                        <button onClick={onClose} className="text-brand-med-gray hover:text-white text-3xl leading-none">&times;</button>
                    </div>
                    <p className="text-sm text-brand-med-gray mt-1">Selecione uma data para gerar um relatório diário com base nas atividades de produção registradas.</p>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div>
                            <label htmlFor="reportDate" className="block text-sm font-medium text-brand-med-gray">Data do Relatório</label>
                            <input
                                type="date"
                                id="reportDate"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="mt-1 block w-full sm:w-auto bg-brand-darkest/50 border border-brand-darkest rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-accent focus:border-brand-accent"
                            />
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full sm:w-auto mt-2 sm:mt-6 flex items-center justify-center gap-2 px-6 py-2 bg-brand-accent text-white rounded-md hover:bg-orange-600 transition shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/40 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            <SparkleIcon className="w-5 h-5" />
                            {isGenerating ? 'Gerando...' : 'Gerar Relatório com IA'}
                        </button>
                    </div>

                    {error && (
                        <div className="mt-4 text-center text-sm text-red-400 bg-red-500/10 p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="mt-6">
                        <textarea
                            readOnly
                            value={isGenerating ? "A IA está analisando os dados e redigindo o relatório..." : generatedReport}
                            placeholder="O relatório gerado aparecerá aqui..."
                            className="w-full h-64 bg-brand-darkest/50 border border-brand-darkest rounded-md p-3 text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
                        />
                    </div>
                </div>
                <div className="p-6 border-t border-brand-accent/20 flex justify-end">
                    <button
                        onClick={handleCopy}
                        disabled={!generatedReport || isGenerating}
                        className="px-4 py-2 bg-brand-med-gray/30 text-gray-100 rounded-md hover:bg-brand-med-gray/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {copySuccess || 'Copiar para Área de Transferência'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RdoModal;