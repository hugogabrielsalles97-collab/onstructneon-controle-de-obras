
import React from 'react';
import Header from './Header';
import { useData } from '../context/DataProvider';

interface CostPageProps {
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToHome?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const CostPage: React.FC<CostPageProps> = ({
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToHome,
    onUpgradeClick,
    showToast
}) => {
    const { currentUser: user, signOut } = useData();

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    return (
        <div className="flex flex-col h-screen bg-[#060a12] text-gray-100 overflow-hidden font-sans">
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
                onUpgradeClick={onUpgradeClick}
                activeScreen="cost"
            />
            <main className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in relative">
                <div className="absolute inset-0 bg-gradient-to-b from-green-900/10 to-transparent pointer-events-none"></div>

                <div className="relative z-10 text-center max-w-2xl">
                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20 shadow-2xl shadow-green-900/20">
                        <span className="text-5xl">💰</span>
                    </div>

                    <h1 className="text-4xl font-black text-white tracking-tight mb-4 uppercase">
                        Gestão de <span className="text-green-500">Custos</span>
                    </h1>

                    <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                        Módulo financeiro em desenvolvimento. Em breve você poderá controlar orçamentos, medições e viabilidade econômica da obra aqui.
                    </p>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-2">
                            <div className="bg-green-500 h-full w-[15%] animate-pulse"></div>
                        </div>
                        <p className="text-xs text-green-400 font-mono text-right">DEV PROGRESS: 15%</p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CostPage;
