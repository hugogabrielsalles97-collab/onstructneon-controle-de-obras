
import React from 'react';
import { useData } from '../context/DataProvider';
import ConstructionIcon from './icons/ConstructionIcon';

interface ModuleSelectionScreenProps {
    onSelectPlanning: () => void;
    onSelectCost: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const ModuleSelectionScreen: React.FC<ModuleSelectionScreenProps> = ({ onSelectPlanning, onSelectCost, showToast }) => {
    const { currentUser: user, signOut } = useData();

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    if (!user) return null;

    // Lógica para obter o nome de exibição (2 primeiros nomes)
    const getDisplayName = () => {
        // Tenta usar o nome completo, ou username, ou email
        let name = user.fullName || user.username || user.email || 'Engenheiro';

        // Se for um email, pega apenas a parte antes do @
        if (name.includes('@')) {
            name = name.split('@')[0];
        }

        // Separa por espaços e pega os 2 primeiros
        const parts = name.split(' ').filter(part => part.trim().length > 0);
        if (parts.length >= 2) {
            return `${parts[0]} ${parts[1]}`;
        } else if (parts.length === 1) {
            return parts[0];
        }

        return name;
    };

    return (
        <div className="min-h-screen bg-[#020202] text-white flex flex-col relative overflow-hidden font-sans selection:bg-brand-accent selection:text-white">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1f2e] via-[#050505] to-[#000000] z-0"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay pointer-events-none"></div>

            {/* Header / Logout */}
            <div className="relative z-20 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity cursor-default">
                    <ConstructionIcon className="w-6 h-6 text-brand-accent" />
                    <span className="text-sm font-bold tracking-widest uppercase text-brand-med-gray">Lean Solution</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                >
                    Sair da Conta
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 pb-20">
                <div className="mb-12 text-center animate-fade-in-up">
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight">
                        Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-orange-400 capitalize">{getDisplayName()}</span>.
                    </h1>
                    <p className="text-gray-400 text-sm md:text-lg font-light tracking-wide">
                        Selecione o módulo de gestão para acessar.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4 animate-fade-in-up delay-100">
                    {/* Card: Planejamento */}
                    <button
                        onClick={onSelectPlanning}
                        className="group relative h-[300px] bg-[#111827]/40 rounded-3xl border border-white/5 overflow-hidden transition-all duration-500 hover:border-brand-accent/50 hover:shadow-[0_0_50px_-10px_rgba(227,90,16,0.3)] hover:-translate-y-2 text-left"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 group-hover:scale-110 transition-transform duration-700">
                            <svg className="w-32 h-32 text-brand-accent transform rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-8 z-10">
                            <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm border border-brand-accent/20 group-hover:bg-brand-accent group-hover:text-white transition-colors duration-300">
                                <svg className="w-6 h-6 text-brand-accent group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-brand-accent transition-colors">Planejamento</h2>
                            <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-[80%] group-hover:text-gray-300 transition-colors">
                                Gestão de cronogramas, Last Planner System, RDOs e controle de produção.
                            </p>
                        </div>
                    </button>

                    {/* Card: Custo */}
                    <button
                        onClick={onSelectCost}
                        className="group relative h-[300px] bg-[#111827]/40 rounded-3xl border border-white/5 overflow-hidden transition-all duration-500 hover:border-green-500/50 hover:shadow-[0_0_50px_-10px_rgba(34,197,94,0.3)] hover:-translate-y-2 text-left"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 group-hover:scale-110 transition-transform duration-700">
                            <svg className="w-32 h-32 text-green-500 transform -rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" /></svg>
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-8 z-10">
                            <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm border border-green-500/20 group-hover:bg-green-500 group-hover:text-white transition-colors duration-300">
                                <svg className="w-6 h-6 text-green-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-green-500 transition-colors">Custos</h2>
                            <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-[80%] group-hover:text-gray-300 transition-colors">
                                Controle de orçamento, medições, fluxo de caixa e viabilidade financeira.
                            </p>
                        </div>
                    </button>
                </div>

                <p className="mt-12 text-[10px] text-gray-600 font-mono tracking-widest uppercase opacity-50">
                    Lean Solution V1.0 • Powered by Hugo AI
                </p>
            </main>
        </div>
    );
};

export default ModuleSelectionScreen;
