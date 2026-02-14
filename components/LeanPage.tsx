import React, { useMemo } from 'react';
import { useData } from '../context/DataProvider';
import Header from './Header';
import { TaskStatus } from '../types';
import LeanIcon from './icons/LeanIcon';
import PpcChart from './PpcChart';

interface LeanPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const LeanPage: React.FC<LeanPageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToAnalysis,
    onNavigateToLean,
    showToast
}) => {
    const { currentUser: user, tasks, baselineTasks, signOut } = useData();

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    // Cálculos de Período (Lookahead de 1 semana a frente + atual)
    const lookaheadData = useMemo(() => {
        const today = new Date();
        const startOfCurrentWeek = new Date(today);
        startOfCurrentWeek.setDate(today.getDate() - today.getDay());
        startOfCurrentWeek.setHours(0, 0, 0, 0);

        const endOfLookahead = new Date(startOfCurrentWeek);
        endOfLookahead.setDate(startOfCurrentWeek.getDate() + 20); // Atual + 2 semanas de Lookahead
        endOfLookahead.setHours(23, 59, 59, 999);

        const filtered = baselineTasks.filter(bt => {
            const btStart = new Date(bt.startDate);
            const btEnd = new Date(bt.dueDate);

            // Atividade intercepta o período (Hoje até Fim do Lookahead)
            return (btStart <= endOfLookahead && btEnd >= today) ||
                (btEnd >= today && btEnd <= endOfLookahead);
        }).map(bt => {
            const linkedTasks = tasks.filter(t => String(t.baseline_id) === String(bt.id));
            const totalPlannedQty = Number(bt.quantity) || 0;
            const rawActualQty = linkedTasks.reduce((acc, t) => acc + (Number(t.actualQuantity) || 0), 0);

            let progress = 0;
            if (totalPlannedQty > 0) progress = Math.min(100, (rawActualQty / totalPlannedQty) * 100);
            else if (linkedTasks.length > 0) progress = linkedTasks.reduce((acc, t) => acc + (Number(t.progress) || 0), 0) / linkedTasks.length;

            const isNextWeek = new Date(bt.dueDate) > new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

            return {
                ...bt,
                currentProgress: Math.round(progress),
                linkedTasks,
                isNextWeek,
                status: progress >= 100 ? 'Pronto' : progress > 0 ? 'Em Fluxo' : 'Planejado'
            };
        });

        const currentWeekTasks = filtered.filter(t => !t.isNextWeek);
        const nextWeekTasks = filtered.filter(t => t.isNextWeek);

        return {
            currentWeekTasks,
            nextWeekTasks,
            totalActive: filtered.length
        };
    }, [baselineTasks, tasks]);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="flex flex-col h-screen">
            <Header
                user={user}
                onLogout={handleLogout}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={() => { }}
                activeScreen="lean"
            />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-[#0a0f18]">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header Lean */}
                    <div className="flex justify-between items-center bg-[#111827] p-6 rounded-2xl border border-white/5 shadow-2xl">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-accent/10 rounded-xl border border-brand-accent/20">
                                <LeanIcon className="w-8 h-8 text-brand-accent" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Sistema Last Planner</h2>
                                <p className="text-xs text-brand-med-gray uppercase font-bold tracking-[0.2em]">Lean Construction • Dashboard de Fluxo</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={onNavigateToDashboard}
                                className="px-6 py-2 bg-brand-dark/50 text-brand-med-gray rounded-xl hover:bg-brand-accent hover:text-white transition-all duration-300 font-bold border border-white/5"
                            >
                                ← Voltar
                            </button>
                        </div>
                    </div>

                    {/* Resumos Lean */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Status do Fluxo */}
                        <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-brand-accent/10 transition-all"></div>
                            <h3 className="text-xs font-black text-brand-med-gray uppercase tracking-widest mb-4">Saúde do Fluxo</h3>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-white">{lookaheadData.totalActive}</span>
                                <span className="text-xs text-brand-med-gray font-bold mb-2">Atividades em Foco</span>
                            </div>
                            <p className="text-[11px] text-brand-med-gray mt-4 leading-relaxed">
                                Estas são as atividades que <span className="text-brand-accent font-bold">devem</span> estar acontecendo para manter o ritmo planejado.
                            </p>
                        </div>

                        {/* Promessas Cumpridas */}
                        <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-green-500/10 transition-all"></div>
                            <h3 className="text-xs font-black text-brand-med-gray uppercase tracking-widest mb-4">Atendimento ao Prazo</h3>
                            <div className="flex items-end gap-2 text-green-500">
                                <span className="text-4xl font-black">{lookaheadData.currentWeekTasks.filter(t => t.currentProgress >= 100).length}</span>
                                <span className="text-xs font-bold mb-2">Concluídas na Semana</span>
                            </div>
                            <p className="text-[11px] text-brand-med-gray mt-4 leading-relaxed">
                                Intensifique o ritmo para garantir que <span className="text-green-500 font-bold">100% das promessas</span> sejam cumpridas até sexta-feira.
                            </p>
                        </div>

                        {/* Lookahead Info */}
                        <div className="bg-[#111827] p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-purple-500/10 transition-all"></div>
                            <h3 className="text-xs font-black text-brand-med-gray uppercase tracking-widest mb-4">Próximas 2 Semanas (Lookahead)</h3>
                            <div className="flex items-end gap-2 text-purple-400">
                                <span className="text-4xl font-black">{lookaheadData.nextWeekTasks.length}</span>
                                <span className="text-xs font-bold mb-2">Itens Planejados</span>
                            </div>
                            <p className="text-[11px] text-brand-med-gray mt-4">
                                Prepare os recursos agora para evitar <span className="text-purple-400 font-bold">restrições</span> no fluxo futuro de 14 dias.
                            </p>
                        </div>
                    </div>

                    {/* Quadro de Programação Lookahead */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Semana Atual - O QUE ESTOU FAZENDO? */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-2 h-6 bg-brand-accent rounded-full"></div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Semana Atual (Execução)</h3>
                            </div>
                            <div className="space-y-3">
                                {lookaheadData.currentWeekTasks.length === 0 ? (
                                    <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-brand-med-gray text-sm">
                                        Nenhuma atividade planejada para finalização esta semana.
                                    </div>
                                ) : (
                                    lookaheadData.currentWeekTasks.map(task => (
                                        <div key={task.id} className="bg-[#111827] border border-white/5 rounded-xl p-4 hover:border-brand-accent/30 transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-brand-accent uppercase bg-brand-accent/10 px-1.5 py-0.5 rounded">#{task.id}</span>
                                                        <span className="text-[10px] text-brand-med-gray uppercase font-bold">{task.location}</span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-100">{task.title}</h4>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-black uppercase ${task.currentProgress >= 100 ? 'text-green-500' : 'text-yellow-500'}`}>
                                                        {task.currentProgress}%
                                                    </span>
                                                    <p className="text-[9px] text-brand-med-gray font-mono mt-1">FIM: {formatDate(task.dueDate)}</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${task.currentProgress >= 100 ? 'bg-green-500' : 'bg-brand-accent'}`}
                                                    style={{ width: `${task.currentProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Lookahead - O QUE VOU FAZER? */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-2 h-6 bg-purple-500 rounded-full"></div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-tight">Horizonte 2 Semanas (Lookahead)</h3>
                            </div>
                            <div className="space-y-3">
                                {lookaheadData.nextWeekTasks.length === 0 ? (
                                    <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-brand-med-gray text-sm">
                                        Monitorando o horizonte... Sem tarefas planejadas para as próximas 2 semanas.
                                    </div>
                                ) : (
                                    lookaheadData.nextWeekTasks.map(task => (
                                        <div key={task.id} className="bg-[#111827]/60 border border-white/5 rounded-xl p-4 hover:border-purple-500/30 transition-all opacity-80 hover:opacity-100">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-purple-400 uppercase bg-purple-400/10 px-1.5 py-0.5 rounded">#{task.id}</span>
                                                        <span className="text-[10px] text-brand-med-gray uppercase font-bold">{task.location}</span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-300">{task.title}</h4>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-purple-400 font-bold">PLANEJADO</p>
                                                    <p className="text-[9px] text-brand-med-gray font-mono mt-1">INÍCIO: {formatDate(task.startDate)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Insights de Desperdício (Muda) */}
                    <div className="bg-[#111827] border border-white/5 rounded-2xl p-8 relative overflow-hidden">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                            <div className="flex-1">
                                <h3 className="text-xl font-black text-white mb-2">Gestão de Restrições</h3>
                                <p className="text-sm text-brand-med-gray mb-6 leading-relaxed">
                                    Para o Lean Construction, não basta Planejar. É preciso <span className="text-brand-accent">Remover Restrições</span>.
                                    Confira se as frentes de serviço das próximas 2 semanas estão liberadas (Materiais, Equipamentos, Projetos e Mão de Obra).
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    {['Materiais', 'Mão de Obra', 'Projetos', 'Segurança', 'Ferramentas'].map(item => (
                                        <div key={item} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-[10px] font-bold text-brand-med-gray uppercase tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent"></div>
                                            {item} OK
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="w-full md:w-1/3 bg-brand-dark/50 p-6 rounded-2xl border border-white/5">
                                <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] mb-4">Meta Semanal</h4>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-white font-bold">Produção Esperada</span>
                                    <span className="text-sm text-brand-med-gray">Setor A + B</span>
                                </div>
                                <div className="text-4xl font-black text-white mt-2">85% <span className="text-xs text-brand-med-gray font-normal">Capacidade Utilizada</span></div>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default LeanPage;
