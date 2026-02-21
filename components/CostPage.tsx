
import React, { useState, useMemo } from 'react';
import Header from './Header';
import { useData } from '../context/DataProvider';
import ConstructionIcon from './icons/ConstructionIcon';
import ChartIcon from './icons/ChartIcon';
import ManagementIcon from './icons/ManagementIcon';
import FileTextIcon from './icons/FileTextIcon';
import AlertIcon from './icons/AlertIcon';

interface CostPageProps {
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
    onNavigateToOrgChart?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToCheckoutSummary?: () => void;
    onNavigateToTeams?: () => void;
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
    onNavigateToWarRoom,
    onNavigateToPodcast,
    onNavigateToCost,
    onNavigateToHome,
    onUpgradeClick,
    onNavigateToOrgChart, onNavigateToVisualControl,
    onNavigateToCheckoutSummary,
    onNavigateToTeams,
    showToast
}) => {
    const { currentUser: user, signOut } = useData();
    const [activeTab, setActiveTab] = useState('dashboard');

    if (!user) return null;

    const handleLogout = async () => {
        const { success, error } = await signOut();
        if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
    };

    const costMenuItems = [
        { id: 'dashboard', label: 'Dashboard de Custos', icon: <ChartIcon className="w-5 h-5" /> },
        { id: 'budget', label: 'Orçamento vs Realizado', icon: <ManagementIcon className="w-5 h-5" /> },
        { id: 'measurements', label: 'Medições de Serviços', icon: <FileTextIcon className="w-5 h-5" /> },
        { id: 'cashflow', label: 'Fluxo de Caixa', icon: <ChartIcon className="w-5 h-5" /> },
        { id: 'materials', label: 'Insumos e Materiais', icon: <ConstructionIcon className="w-5 h-5" /> },
    ];

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            {/* Sidebar Navigation - Green Theme */}
            <aside className="hidden lg:flex flex-col w-72 bg-[#0a0f18] border-r border-white/5 non-printable transition-all duration-300">
                <div className="p-8 flex-1">
                    <div className="flex flex-col mb-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/20">
                                <ConstructionIcon className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tighter">LEAN</h1>
                        </div>
                        <p className="text-[10px] text-green-500 font-black uppercase tracking-[0.2em] ml-13 mt-[-4px] ml-[52px]">SOLUTION • V1.0</p>
                    </div>

                    <nav className="space-y-2">
                        <h3 className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mb-4 ml-2">Módulo Financeiro</h3>

                        {costMenuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${activeTab === item.id
                                    ? 'bg-green-600 text-white shadow-lg shadow-green-600/20 font-bold'
                                    : 'text-brand-med-gray hover:bg-white/5 hover:text-white font-medium'
                                    }`}
                            >
                                <div className={`transition-transform duration-300 group-hover:scale-110 ${activeTab === item.id ? 'text-white' : 'text-green-500/70'}`}>
                                    {item.icon}
                                </div>
                                <span className="text-sm tracking-tight whitespace-nowrap">{item.label}</span>
                            </button>
                        ))}

                        <div className="pt-4 border-t border-white/5 mt-4 space-y-2">
                            <button
                                onClick={onNavigateToPodcast}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group text-brand-med-gray hover:bg-white/5 hover:text-white font-medium"
                            >
                                <div className="text-purple-400/70 transition-transform duration-300 group-hover:scale-110">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                </div>
                                <span className="text-sm tracking-tight">Podcast da obra</span>
                            </button>
                            <button
                                onClick={onNavigateToWarRoom}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group text-brand-med-gray hover:bg-white/5 hover:text-white font-medium"
                            >
                                <div className="text-red-500/70 transition-transform duration-300 group-hover:scale-110">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                        <line x1="8" y1="21" x2="16" y2="21" />
                                        <line x1="12" y1="17" x2="12" y2="21" />
                                    </svg>
                                </div>
                                <span className="text-sm tracking-tight">War Room (TV)</span>
                            </button>
                        </div>
                    </nav>
                </div>

                <div className="p-6 bg-brand-darkest/50 animate-slide-up animate-stagger-4 mt-auto">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 smooth-transition group cursor-pointer hover-shine relative overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center text-white font-black shadow-lg group-hover:rotate-6 smooth-transition">
                            {user.fullName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white truncate leading-none">{user.fullName}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] font-bold text-brand-med-gray uppercase tracking-wider">{user.role}</p>
                                <button
                                    onClick={onUpgradeClick}
                                    className="text-[8px] bg-green-600/20 text-green-500 border border-green-600/30 px-1.5 py-0.5 rounded hover:bg-green-600 hover:text-white transition-all font-black uppercase"
                                >
                                    Upgrade
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
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
                    onNavigateToPodcast={onNavigateToPodcast}
                    onNavigateToCost={onNavigateToCost}
                    onNavigateToCheckoutSummary={onNavigateToCheckoutSummary}
                    onNavigateToOrgChart={onNavigateToOrgChart}
                onNavigateToVisualControl={onNavigateToVisualControl}
                    onUpgradeClick={onUpgradeClick}
                    activeScreen="cost"
                />

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 animate-slide-up animate-stagger-2">
                    <div className="max-w-screen-2xl mx-auto space-y-8">

                        {/* Action Bar */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight italic uppercase flex items-center gap-4">
                                    {costMenuItems.find(i => i.id === activeTab)?.label}
                                    <span className="text-[10px] bg-green-500/20 text-green-500 border border-green-500/30 px-3 py-1 rounded-full animate-pulse not-italic normal-case tracking-normal">
                                        Em Desenvolvimento
                                    </span>
                                </h2>
                                <p className="text-sm text-brand-med-gray">Controle financeiro e viabilidade econômica da obra.</p>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => showToast('Módulo em desenvolvimento.', 'success')}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-500 transition-all duration-300 font-bold shadow-xl shadow-green-600/20 border border-white/10"
                                >
                                    <span>Nova Medição</span>
                                </button>
                            </div>
                        </div>

                        {/* Placeholder Content for the Module */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-[#111827]/60 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl group hover:border-green-500/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                                        💰
                                    </div>
                                    <span className="text-[10px] font-black text-green-500 bg-green-500/10 px-2 py-1 rounded-lg uppercase">Orçado</span>
                                </div>
                                <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest mb-1">Total Orçado</p>
                                <h3 className="text-2xl font-black text-white">R$ 12.450.000</h3>
                                <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-green-600 h-full w-[100%]"></div>
                                </div>
                            </div>

                            <div className="bg-[#111827]/60 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl group hover:border-green-500/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                                        📊
                                    </div>
                                    <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg uppercase">Realizado</span>
                                </div>
                                <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest mb-1">Total Realizado</p>
                                <h3 className="text-2xl font-black text-white">R$ 1.867.500</h3>
                                <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full w-[15%]"></div>
                                </div>
                            </div>

                            <div className="bg-[#111827]/60 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl group hover:border-green-500/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                                        ⚖️
                                    </div>
                                    <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-lg uppercase">Saldo</span>
                                </div>
                                <p className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest mb-1">Saldo Remanescente</p>
                                <h3 className="text-2xl font-black text-white">R$ 10.582.500</h3>
                                <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-orange-500 h-full w-[85%]"></div>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-[#111827]/40 rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-600/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-green-600 rounded-full"></div>
                                    Curva S Financeira (Simulado)
                                </h3>
                                <div className="h-64 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-center text-brand-med-gray italic">
                                    Gráfico de evolução financeira em breve...
                                </div>
                            </div>

                            <div className="bg-[#111827]/40 rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    Maiores Desembolsos
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        { label: 'Concreto Usinado', value: 'R$ 450.000', color: 'bg-green-500' },
                                        { label: 'Aço CA-50', value: 'R$ 320.000', color: 'bg-green-500' },
                                        { label: 'Mão de Obra Fôrmas', value: 'R$ 280.000', color: 'bg-green-500' },
                                        { label: 'Locação de Grua', value: 'R$ 150.000', color: 'bg-green-500' },
                                    ].map((item, id) => (
                                        <div key={id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-sm font-bold text-gray-300">{item.label}</span>
                                            <span className="text-sm font-black text-white">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Empty State / Coming Soon */}
                        <div className="text-center py-20 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center space-y-6">
                            <div className="w-20 h-20 bg-green-600/10 rounded-full flex items-center justify-center text-green-600 animate-pulse">
                                <AlertIcon className="w-10 h-10 opacity-40" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-white text-2xl font-black italic uppercase tracking-tighter">Módulo em Desenvolvimento</p>
                                <p className="text-sm text-brand-med-gray font-bold tracking-wide">A integração completa com o banco de dados de custos está sendo preparada.</p>
                            </div>
                            <button
                                onClick={onNavigateToHome}
                                className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                            >
                                Voltar para Planejamento
                            </button>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
};

export default CostPage;
