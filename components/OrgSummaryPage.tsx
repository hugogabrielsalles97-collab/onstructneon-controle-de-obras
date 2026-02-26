
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

    const engineerSummaries = useMemo(() => {
        const engineers = members.filter(m => m.role.toLowerCase().includes('engenheiro'));

        return engineers.map(eng => {
            const counts: Record<string, number> = {};
            const processedIds = new Set<string>();

            const addDescendants = (parentId: string) => {
                const children = members.filter(m => m.parent_id === parentId);
                children.forEach(child => {
                    if (!processedIds.has(child.id)) {
                        processedIds.add(child.id);
                        const roleKey = child.role.trim().toUpperCase();
                        const count = child.quantity || 1;
                        counts[roleKey] = (counts[roleKey] || 0) + count;
                        addDescendants(child.id);
                    }
                });
            };

            addDescendants(eng.id);
            return {
                id: eng.id,
                name: eng.name || 'Engenheiro sem Nome',
                role: eng.role,
                data: counts
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [members]);

    interface SummaryCardProps {
        name: string;
        role: string;
        data: Record<string, number>;
    }

    const SummaryCard: React.FC<SummaryCardProps> = ({ name, role, data }) => {
        const items = Object.entries(data).sort((a, b) => (b[1] as number) - (a[1] as number));
        const total = items.reduce((acc, curr) => acc + (curr[1] as number), 0);

        return (
            <div className="bg-[#111827]/60 border border-white/5 rounded-3xl p-6 backdrop-blur-xl group hover:border-blue-500/30 transition-all duration-500 flex flex-col h-full overflow-hidden shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                        <ManagementIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5 truncate">{role}</h3>
                        <p className="text-lg font-black text-white tracking-tight uppercase truncate">{name || 'Sem Nome'}</p>
                    </div>
                    <div className="bg-blue-600 px-3 py-1 rounded-full shadow-lg shadow-blue-600/20 flex-shrink-0">
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter">{total}</span>
                    </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                    {items.map(([roleName, count]) => (
                        <div key={roleName} className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight truncate pr-2 max-w-[140px]">{roleName}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white">{count}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40"></div>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="h-full flex items-center justify-center py-10 opacity-30">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sem equipe vinculada</p>
                        </div>
                    )}
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
                                    Resumo <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Executivo</span>
                                </h1>
                                <p className="text-brand-med-gray font-bold uppercase text-[10px] tracking-[0.4em] ml-1">Controle de Contingente por Engenharia</p>
                            </div>

                            <button
                                onClick={props.onNavigateToOrgChart}
                                className="group flex items-center gap-4 bg-white/5 border border-white/10 px-8 py-4 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all duration-500"
                            >
                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <ManagementIcon className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <span className="block text-[8px] font-black text-gray-500 uppercase tracking-widest">Acessar Completo</span>
                                    <span className="block text-sm font-black text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">Visualizar Árvore</span>
                                </div>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {engineerSummaries.slice(0, 3).map(eng => (
                                <SummaryCard
                                    key={eng.id}
                                    name={eng.name}
                                    role={eng.role}
                                    data={eng.data}
                                />
                            ))}
                            {engineerSummaries.length === 0 && (
                                <div className="col-span-full py-12 text-center opacity-40">
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nenhum Engenheiro localizado no organograma.</p>
                                </div>
                            )}
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
