
import React, { useMemo } from 'react';
import { useData } from '../context/DataProvider';
import { useOrgMembers } from '../hooks/dataHooks';
import Header from './Header';
import Sidebar from './Sidebar';
import ManagementIcon from './icons/ManagementIcon';

interface OrgSummaryPageProps {
    onNavigateToHome: () => void;
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
    onNavigateToCheckoutSummary: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToOrgSummary?: () => void;
    onNavigateToVisualControl?: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const OrgSummaryPage: React.FC<OrgSummaryPageProps> = (props) => {
    const { currentUser: user, signOut } = useData();
    const { data: members = [] } = useOrgMembers();

    const handleLogout = async () => {
        await signOut();
    };

    const summaries = useMemo(() => {
        const calculateForPattern = (pattern: string) => {
            const targets = members.filter(m => m.role.toLowerCase().includes(pattern.toLowerCase()));
            const counts: Record<string, number> = {};
            const processedIds = new Set<string>();

            targets.forEach(target => {
                const addDescendants = (parentId: string) => {
                    const children = members.filter(m => m.parent_id === parentId);
                    children.forEach(child => {
                        if (!processedIds.has(child.id)) {
                            processedIds.add(child.id);
                            const count = child.quantity || 1;
                            counts[child.role] = (counts[child.role] || 0) + count;
                            addDescendants(child.id);
                        }
                    });
                };
                addDescendants(target.id);
            });
            return counts;
        };

        return {
            eng: calculateForPattern('Engenheiro'),
            mestre: calculateForPattern('Mestre')
        };
    }, [members]);

    const SummaryCard = ({ title, data, icon }: { title: string, data: Record<string, number>, icon: React.ReactNode }) => {
        const items = Object.entries(data).sort((a, b) => b[1] - a[1]);
        const total = items.reduce((acc, curr) => acc + curr[1], 0);

        if (total === 0) return (
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-2xl flex flex-col items-center justify-center text-center opacity-50">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                    {icon}
                </div>
                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Sem dados para {title}</p>
            </div>
        );

        return (
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-2xl shadow-2xl group hover:border-cyan-500/30 transition-all duration-700">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-16 h-16 bg-cyan-500/10 rounded-[1.5rem] flex items-center justify-center text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all duration-500">
                        {icon}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[2px] mb-1">Resumo de Contingente</h3>
                        <p className="text-2xl font-black text-white tracking-tight uppercase leading-none">{title}</p>
                    </div>
                    <div className="bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] px-5 py-2 rounded-full">
                        <span className="text-xs font-black text-white uppercase tracking-wider">{total} Total</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map(([role, count]) => (
                        <div key={role} className="flex justify-between items-center group/item p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all">
                            <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wide group-hover/item:text-cyan-300 transition-colors line-clamp-1">{role}</span>
                                <div className="w-10 h-0.5 bg-cyan-500/20 rounded-full mt-1.5 overflow-hidden">
                                    <div className="h-full bg-cyan-500 w-full animate-pulse-slow"></div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-lg font-black text-white">{count}</span>
                                <span className="text-[8px] font-bold text-gray-600 uppercase tracking-wider">Colab.</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!user) return null;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="orgSummary"
                onNavigateToHome={props.onNavigateToHome}
                onNavigateToDashboard={props.onNavigateToDashboard}
                onNavigateToReports={props.onNavigateToReports}
                onNavigateToBaseline={props.onNavigateToBaseline}
                onNavigateToCurrentSchedule={props.onNavigateToCurrentSchedule}
                onNavigateToAnalysis={props.onNavigateToAnalysis}
                onNavigateToLean={props.onNavigateToLean}
                onNavigateToLeanConstruction={props.onNavigateToLeanConstruction}
                onNavigateToWarRoom={props.onNavigateToWarRoom}
                onNavigateToPodcast={props.onNavigateToPodcast}
                onNavigateToCheckoutSummary={props.onNavigateToCheckoutSummary}
                onNavigateToOrgChart={props.onNavigateToOrgChart}
                onNavigateToOrgSummary={() => { }}
                onNavigateToVisualControl={props.onNavigateToVisualControl}
                onUpgradeClick={props.onUpgradeClick}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50">
                <Header
                    user={user}
                    onLogout={handleLogout}
                    activeScreen="orgSummary"
                    {...props}
                />

                <div className="flex-1 overflow-auto p-12 custom-scrollbar animate-slide-up">
                    <div className="max-w-7xl mx-auto space-y-12">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-2">
                                <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
                                    Resumo do <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Organograma</span>
                                </h1>
                                <p className="text-brand-med-gray font-bold uppercase text-xs tracking-[0.3em]">Gestão de Contingente e Liderança</p>
                            </div>

                            <button
                                onClick={props.onNavigateToOrgChart}
                                className="group flex items-center gap-4 bg-white/5 border border-white/10 px-8 py-4 rounded-2xl hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-500"
                            >
                                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                                    <ManagementIcon className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <span className="block text-[8px] font-black text-gray-500 uppercase tracking-widest">Acessar Completo</span>
                                    <span className="block text-sm font-black text-white uppercase tracking-tight group-hover:text-cyan-400 transition-colors">Visualizar Árvore</span>
                                </div>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-12">
                            <SummaryCard
                                title="Equipes sob Gestão dos Engenheiros"
                                data={summaries.eng}
                                icon={<ManagementIcon className="w-8 h-8" />}
                            />

                            <SummaryCard
                                title="Equipes sob Gestão dos Mestres"
                                data={summaries.mestre}
                                icon={<ManagementIcon className="w-8 h-8 opacity-70" />}
                            />
                        </div>

                        {members.length === 0 && (
                            <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-[2.5rem] p-20 text-center space-y-6">
                                <div className="w-24 h-24 bg-cyan-500/10 rounded-3xl flex items-center justify-center mx-auto border border-cyan-500/20">
                                    <ManagementIcon className="w-12 h-12 text-cyan-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Organograma Vazio</h3>
                                    <p className="text-gray-400 max-w-md mx-auto">Você ainda não cadastrou a estrutura da sua obra. Cadastre os engenheiros e mestres para visualizar o resumo.</p>
                                </div>
                                <button
                                    onClick={props.onNavigateToOrgChart}
                                    className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-cyan-500/20 transition-all"
                                >
                                    Começar Cadastro
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OrgSummaryPage;
