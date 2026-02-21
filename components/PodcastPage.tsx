import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { User, TaskStatus, RestrictionStatus, RestrictionPriority } from '../types';
import ConstructionIcon from './icons/ConstructionIcon';
import { useData } from '../context/DataProvider';
import { GoogleGenerativeAI } from "@google/generative-ai";
import SparkleIcon from './icons/SparkleIcon';

interface PodcastPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToWarRoom: () => void;
    onNavigateToCost: () => void;
    onNavigateToPodcast: () => void;
    onNavigateToHome?: () => void;
    onNavigateToCheckoutSummary?: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToTeams?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    user: User;
    signOut: () => Promise<{ success: boolean; error?: string }>;
}

const PodcastPage: React.FC<PodcastPageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToWarRoom,
    onNavigateToCost,
    onNavigateToPodcast,
    onNavigateToHome,
    onUpgradeClick,
    onNavigateToCheckoutSummary,
    onNavigateToOrgChart, onNavigateToVisualControl,
    onNavigateToTeams,
    showToast,
    user,
    signOut
}) => {
    const { tasks, restrictions } = useData();
    const canUsePodcast = user.role === 'Master' || user.role === 'Gerenciador';
    const [podcastItems, setPodcastItems] = useState<any[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

    const handlePlayAudio = (text: string, id: string) => {
        // Stop any current speech
        window.speechSynthesis.cancel();

        if (currentlyPlaying === id) {
            setCurrentlyPlaying(null);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);

        // Find best human-like Portuguese voice
        const voices = window.speechSynthesis.getVoices();
        const ptVoices = voices.filter(v => v.lang.startsWith('pt-BR'));

        // Priority: Google Online voices > Microsoft Online voices > Natural > Local
        const bestVoice =
            ptVoices.find(v => v.name.includes('Google') && v.name.includes('Online')) ||
            ptVoices.find(v => v.name.includes('Microsoft') && v.name.includes('Online')) ||
            ptVoices.find(v => v.name.includes('Natural')) ||
            ptVoices.find(v => v.name.includes('Google')) ||
            ptVoices[0];

        if (bestVoice) {
            utterance.voice = bestVoice;
        }

        utterance.lang = 'pt-BR';
        utterance.rate = 0.95; // Slightly slower is usually more pleasant and professional
        utterance.pitch = 1.05; // Slightly higher pitch for clarity and energy

        utterance.onstart = () => setCurrentlyPlaying(id);
        utterance.onend = () => setCurrentlyPlaying(null);
        utterance.onerror = () => {
            setCurrentlyPlaying(null);
            showToast("Erro ao reproduzir áudio.", 'error');
        };

        window.speechSynthesis.speak(utterance);
    };

    const generatePodcastItems = async () => {
        if (!canUsePodcast) {
            onUpgradeClick();
            return;
        }
        setIsGenerating(true);
        try {
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENAI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            // Filter data
            const completedYesterday = tasks.filter(t => {
                if (t.status !== TaskStatus.Completed || !t.actualEndDate) return false;
                const doneDate = new Date(t.actualEndDate + 'T00:00:00');
                return doneDate.getTime() === yesterday.getTime();
            });

            const todoToday = tasks.filter(t => {
                if (t.status === TaskStatus.Completed) return false;
                const dueDate = new Date(t.dueDate + 'T00:00:00');
                return dueDate.getTime() <= today.getTime();
            });

            const activeRestrictions = restrictions.filter(r => r.status !== RestrictionStatus.Resolved);
            const resolvedYesterday = restrictions.filter(r => {
                if (r.status !== RestrictionStatus.Resolved || !r.resolved_at) return false;
                const resDate = new Date(r.resolved_at);
                resDate.setHours(0, 0, 0, 0);
                return resDate.getTime() === yesterday.getTime();
            });

            const dataContext = {
                date: today.toLocaleDateString('pt-BR'),
                completedYesterday: completedYesterday.map(t => ({ title: t.title, resp: t.assignee })),
                todoToday: todoToday.map(t => ({ title: t.title, resp: t.assignee, status: t.status })),
                activeRestrictions: activeRestrictions.map(r => ({ desc: r.description, priority: r.priority, sector: r.type })),
                resolvedYesterdayCount: resolvedYesterday.length
            };

            const prompt = `
                Você é um Engenheiro de Planejamento Sênior de Obras Pesadas.
                Crie o conteúdo para o "Podcast da Obra" focado exclusivamente nos dados do projeto.
                O podcast deve ter um roteiro para aproximadamente 5 minutos de fala.
                
                DADOS DO PROJETO (${dataContext.date}):
                - Concluído Ontem: ${JSON.stringify(dataContext.completedYesterday)}
                - Plano para Hoje: ${JSON.stringify(dataContext.todoToday)}
                - Restrições Ativas e Setores Responsáveis: ${JSON.stringify(dataContext.activeRestrictions)}
                - Restrições Resolvidas Ontem: ${dataContext.resolvedYesterdayCount}

                TAREFA:
                Gere o conteúdo em 4 partes específicas em formato JSON. Cada descrição deve ser um texto corrido, técnico e claro, preparado para ser lido em voz alta (narração profissional).
                1. "Performance de Ontem": Analise o que foi entregue, quem participou e as vitórias contra as restrições.
                2. "Objetivos de Hoje": Detalhe as tarefas prioritárias de hoje e os responsáveis.
                3. "Mapa de Restrições": Liste o que está travando a obra, quais os impactos previstos e quais setores (Financeiro, Suprimentos, Engenharia, etc) precisam agir.
                4. "Análise de Impacto": Uma visão técnica de como o não cumprimento das metas de hoje impactará a sequência da obra pesada.

                IMPORTANTE:
                - NÃO fale sobre notícias externas ou inovações. APENAS dados do projeto.
                - Ignore Linha de Base e Cronograma Corrente.
                - Use tom técnico de Engenharia Pesada.
                - O JSON deve ser um array de 4 objetos:
                  [{ "id": string, "title": string, "description": string, "duration": "1 min", "timeAgo": "Agora", "badgeText": string, "badgeColor": "green" | "blue" | "red" | "purple" }]
                
                Responda APENAS com o JSON válido.
            `;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const items = JSON.parse(cleanJson);
            setPodcastItems(items);
            showToast("Relatório diário atualizado!", 'success');
        } catch (error) {
            console.error("Erro Podcast:", error);
            showToast("Erro ao processar dados do projeto.", 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden font-sans">
            <Sidebar
                user={user}
                activeScreen="podcast"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToWarRoom={onNavigateToWarRoom}
                onNavigateToCost={onNavigateToCost}
                onNavigateToPodcast={onNavigateToPodcast}
                onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToVisualControl={onNavigateToVisualControl}
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
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToWarRoom={onNavigateToWarRoom}
                    onNavigateToCost={onNavigateToCost}
                    onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToVisualControl={onNavigateToVisualControl}
                    onNavigateToPodcast={onNavigateToPodcast}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="podcast"
                />

                <div className="flex-1 overflow-y-auto p-8 animate-slide-up relative flex flex-col">
                    {!canUsePodcast ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in relative z-10">
                            <div className="w-32 h-32 bg-brand-accent/10 rounded-[2.5rem] flex items-center justify-center mb-8 border border-brand-accent/20 shadow-2xl relative group">
                                <div className="absolute inset-0 bg-brand-accent rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                                <svg className="w-16 h-16 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic mb-6">Acesso <span className="text-brand-accent">Restrito</span></h2>
                            <p className="text-brand-med-gray text-lg max-w-lg mx-auto mb-10 leading-relaxed font-light">
                                O <strong className="text-white font-bold italic text-base">Podcast da Obra</strong> utiliza inteligência artificial avançada para narrar o status do seu projeto.
                                <br /><br />
                                Esta funcionalidade é exclusiva para os perfis <span className="text-brand-accent font-bold">Gerenciador</span> e <span className="text-brand-accent font-bold">Master</span>.
                            </p>
                            <button
                                onClick={onUpgradeClick}
                                className="px-12 py-5 bg-gradient-to-r from-brand-accent to-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-brand-accent/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-3"
                            >
                                <span className="text-lg">⚡</span> Finalizar Upgrade de Perfil
                            </button>

                            {/* Background Elements for Bloqueio */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-accent/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
                        </div>
                    ) : (
                        <>
                            {/* Background Elements */}
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>

                            <div className="max-w-4xl mx-auto text-center space-y-12 py-12 relative z-10">
                                <div className="inline-block p-6 rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/10 border border-white/10 shadow-2xl mb-8 group hover:scale-105 transition-transform duration-500">
                                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.4)]">
                                        <svg className="w-12 h-12 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Podcast da <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">obra</span></h1>
                                    <p className="text-xl text-brand-med-gray font-light max-w-2xl mx-auto">
                                        Acompanhe as principais novidades e atualizações de sua obra em forma de áudio.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 text-left">
                                    {!podcastItems && !isGenerating ? (
                                        <>
                                            <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl hover:border-purple-500/30 transition-all group cursor-pointer hover:-translate-y-1">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 font-bold border border-green-500/20 text-[10px] text-center leading-tight uppercase font-black">ONTEM</div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors uppercase font-black tracking-tighter">Desempenho Anterior</h3>
                                                        <p className="text-sm text-gray-400 mt-1">Análise do que foi executado, metas batidas e restrições vencidas ontem.</p>
                                                        <div className="flex items-center gap-3 mt-4 text-xs font-mono text-gray-600">
                                                            <span>5 min</span> • <span className="text-purple-400 font-bold italic">Aguardando Geração</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl hover:border-blue-500/30 transition-all group cursor-pointer hover:-translate-y-1">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold border border-blue-500/20 text-[10px] text-center leading-tight uppercase font-black">HOJE</div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors uppercase font-black tracking-tighter">Prioridades do Dia</h3>
                                                        <p className="text-sm text-gray-400 mt-1">Metas críticas, responsáveis e alertas de restrições para hoje.</p>
                                                        <div className="flex items-center gap-3 mt-4 text-xs font-mono text-gray-600">
                                                            <span>5 min</span> • <span className="text-blue-400 font-bold italic">Aguardando Geração</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        podcastItems?.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                onClick={() => handlePlayAudio(item.description, item.id)}
                                                className={`bg-[#111827]/60 backdrop-blur-xl border ${currentlyPlaying === item.id ? 'border-brand-accent shadow-[0_0_20px_rgba(var(--brand-accent-rgb),0.2)]' : 'border-white/10'} p-6 rounded-2xl hover:border-brand-accent/30 transition-all group cursor-pointer hover:-translate-y-1 animate-slide-up relative overflow-hidden`}
                                                style={{ animationDelay: `${idx * 150}ms` }}
                                            >
                                                {currentlyPlaying === item.id && (
                                                    <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent animate-pulse-slow"></div>
                                                )}
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-12 h-12 rounded-lg bg-${item.badgeColor === 'green' ? 'green' : item.badgeColor === 'blue' ? 'blue' : item.badgeColor === 'red' ? 'red' : 'purple'}-500/10 flex items-center justify-center text-${item.badgeColor === 'green' ? 'green' : item.badgeColor === 'blue' ? 'blue' : item.badgeColor === 'red' ? 'red' : 'purple'}-400 font-bold border border-${item.badgeColor === 'green' ? 'green' : item.badgeColor === 'blue' ? 'blue' : item.badgeColor === 'red' ? 'red' : 'purple'}-500/20 text-[9px] text-center leading-none uppercase`}>
                                                        {item.badgeText}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white group-hover:text-brand-accent transition-colors uppercase tracking-tight font-black">{item.title}</h3>
                                                        <p className="text-sm text-gray-400 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                                                        <div className="flex items-center gap-3 mt-4 text-xs font-mono text-gray-600">
                                                            <span>{item.duration || '1 min'}</span> • <span>{item.timeAgo || 'Agora'}</span> •
                                                            <span className={`${currentlyPlaying === item.id ? 'text-brand-accent animate-pulse' : 'text-brand-accent'} font-bold flex items-center gap-2`}>
                                                                {currentlyPlaying === item.id ? (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                                                                        Tocando...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                                        Ouvir Agora
                                                                    </>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="flex justify-center mt-12 mb-20">
                                    <button
                                        onClick={generatePodcastItems}
                                        disabled={isGenerating}
                                        className={`flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-brand-accent to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-brand-accent/20 transition-all transform hover:-translate-y-1 active:scale-95 group ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <SparkleIcon className={`w-5 h-5 ${isGenerating ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
                                        {isGenerating ? 'Processando Briefing...' : 'Gerar Podcast do Projeto (5 min)'}
                                    </button>
                                </div>

                                {!podcastItems && !isGenerating && (
                                    <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-12 text-center group hover:bg-white/10 transition-all duration-500">
                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-med-gray/30 group-hover:scale-110 transition-transform">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-white font-bold text-lg mb-2">Engenharia Baseada em Dados</h3>
                                        <p className="text-gray-400 text-sm max-w-sm mx-auto">Relatório executivo focado em Ontem e Hoje. Processamos restrições, setores e impactos reais do seu canteiro.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default PodcastPage;
