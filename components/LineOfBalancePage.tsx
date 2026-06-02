import React, { useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { useData } from '../context/DataProvider';
import LineOfBalanceChart from './LineOfBalanceChart';

interface LineOfBalancePageProps {
    onNavigateToHome?: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToMonitoringControl?: () => void;
    onNavigateToLineOfBalance?: () => void;
    onNavigateToWarRoom?: () => void;
    onNavigateToPodcast?: () => void;
    onNavigateToCost?: () => void;
    onNavigateToCheckoutSummary: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToOrgSummary?: () => void;
    onNavigateToTeams?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToSystem?: () => void;
    onUpgradeClick: () => void;
    onAddTask?: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const LineOfBalancePage: React.FC<LineOfBalancePageProps> = (props) => {
    // Usa as MESMAS atividades da Programação Semanal (tabela `tasks`)
    const { currentUser: user, tasks } = useData();

    const [disciplineFilter, setDisciplineFilter] = useState('');

    const disciplineOptions = useMemo(() => {
        const set = new Set<string>();
        for (const t of tasks) {
            if (t.discipline) set.add(t.discipline);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        if (!disciplineFilter) return tasks;
        return tasks.filter(t => t.discipline === disciplineFilter);
    }, [tasks, disciplineFilter]);

    if (!user) return null;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar user={user} activeScreen="lineOfBalance" {...props} />

            <main className="flex-1 overflow-y-auto relative custom-scrollbar">
                <div className="p-4 lg:p-8 pb-12 max-w-screen-2xl mx-auto space-y-6">
                    {/* Cabeçalho */}
                    <div className="flex justify-between items-start non-printable flex-wrap gap-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-emerald-400">
                                    <path d="M3 3v18h18" />
                                    <path d="M7 16l4-6 4 3 5-8" />
                                </svg>
                                <h2 className="text-2xl font-black text-gray-100 tracking-tight">Linha de Balanço</h2>
                            </div>
                            <p className="text-[10px] text-brand-med-gray uppercase font-bold tracking-widest ml-10">
                                Ritmo de produção por nível — baseado nas atividades da Programação Semanal
                            </p>
                        </div>

                        {/* Filtro por disciplina */}
                        <div className="flex items-center gap-3">
                            <label htmlFor="lob-discipline" className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest">
                                Disciplina
                            </label>
                            <select
                                id="lob-discipline"
                                value={disciplineFilter}
                                onChange={e => setDisciplineFilter(e.target.value)}
                                className="bg-[#0a0f18] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 shadow-inner appearance-none custom-select min-w-[200px]"
                            >
                                <option value="">Todas as disciplinas</option>
                                {disciplineOptions.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            {disciplineFilter && (
                                <button
                                    onClick={() => setDisciplineFilter('')}
                                    className="text-[10px] font-bold text-brand-med-gray hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="bg-[#111827]/40 backdrop-blur-sm p-4 lg:p-6 rounded-2xl border border-white/5 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Diagrama Tempo × Nível</h3>
                            </div>
                            <span className="text-[10px] font-bold text-brand-med-gray bg-white/5 px-2 py-1 rounded-full">
                                {filteredTasks.length} atividades
                            </span>
                        </div>

                        {filteredTasks.length === 0 ? (
                            <div className="h-[400px] flex items-center justify-center text-brand-med-gray italic text-sm">
                                Nenhuma atividade encontrada na Programação Semanal para gerar a Linha de Balanço.
                            </div>
                        ) : (
                            <LineOfBalanceChart tasks={filteredTasks} />
                        )}

                        <p className="text-[10px] text-brand-med-gray mt-4 leading-relaxed">
                            Cada ponto é uma atividade posicionada pela <span className="text-emerald-400 font-bold">data de início</span> (eixo
                            horizontal) e pelo <span className="text-emerald-400 font-bold">nível</span> (eixo vertical). As linhas ligam
                            atividades da mesma disciplina, revelando o ritmo e possíveis cruzamentos/conflitos de frente. Os dados vêm das
                            mesmas atividades da Programação Semanal.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LineOfBalancePage;
