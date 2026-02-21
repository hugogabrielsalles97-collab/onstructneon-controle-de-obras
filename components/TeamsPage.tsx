
import React, { useMemo } from 'react';
import { useData } from '../context/DataProvider';
import { useOrgMembers } from '../hooks/dataHooks';
import { OrgMember } from '../types';
import Header from './Header';
import Sidebar from './Sidebar';
import UserIcon from './icons/UserIcon';
import ManagementIcon from './icons/ManagementIcon';

interface TeamsPageProps {
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
    onNavigateToOrgChart: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToTeams: () => void;
    onUpgradeClick: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const TeamsPage: React.FC<TeamsPageProps> = (props) => {
    const { currentUser: user, signOut } = useData();
    const { data: members = [] } = useOrgMembers();

    const handleLogout = async () => {
        await signOut();
    };

    // Resumo das equipes seguindo a lógica solicitada
    const teamHierarchy = useMemo(() => {
        const idMap: Record<string, OrgMember & { children: any[] }> = {};
        const roots: any[] = [];

        members.forEach(m => {
            idMap[m.id] = { ...m, children: [] };
        });

        members.forEach(m => {
            if (m.parent_id && idMap[m.parent_id]) {
                idMap[m.parent_id].children.push(idMap[m.id]);
            } else {
                roots.push(idMap[m.id]);
            }
        });

        return roots;
    }, [members]);

    const renderTeamSummary = (node: any, level = 0) => {
        const hasChildren = node.children.length > 0;

        // Formata a string de resumo para este nó
        const childSummaries = node.children.map((child: any) => {
            if (child.quantity && child.quantity > 0) {
                return `${child.quantity} ${child.role}`;
            }
            return `${child.role} (${child.name})`;
        });

        const summaryText = childSummaries.length > 0
            ? `${node.role} ${node.name ? `(${node.name})` : ''} coordena: ${childSummaries.join(', ')}.`
            : null;

        return (
            <div key={node.id} className="space-y-4">
                {summaryText && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all group">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-white text-sm font-medium leading-relaxed">
                                    <span className="text-cyan-400 font-black uppercase text-[10px] tracking-widest block mb-1">
                                        Núcleo de {node.name || node.role}
                                    </span>
                                    {summaryText}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {hasChildren && (
                    <div className={`${level === 0 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}`}>
                        {node.children.map((child: any) => renderTeamSummary(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (!user) return null;

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="teams"
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
                onNavigateToVisualControl={props.onNavigateToVisualControl}
                onUpgradeClick={props.onUpgradeClick}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50">
                <Header
                    user={user}
                    onLogout={handleLogout}
                    activeScreen="teams"
                    {...props}
                />

                <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                    <div className="max-w-5xl mx-auto">
                        <div className="mb-12">
                            <h1 className="text-4xl font-black text-white tracking-tighter">Resumo de Equipes</h1>
                            <p className="text-brand-med-gray font-bold">Visão consolidada da hierarquia e efetivo da obra.</p>
                        </div>

                        {teamHierarchy.length > 0 ? (
                            <div className="space-y-8">
                                {teamHierarchy.map(root => renderTeamSummary(root))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
                                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                                    <ManagementIcon className="w-10 h-10 text-gray-500" />
                                </div>
                                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Nenhuma equipe configurada no organograma</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TeamsPage;
