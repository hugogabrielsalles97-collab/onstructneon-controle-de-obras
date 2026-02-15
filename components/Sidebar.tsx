
import React from 'react';
import { User } from '../types';
import ConstructionIcon from './icons/ConstructionIcon';
import ChartIcon from './icons/ChartIcon';
import BaselineIcon from './icons/BaselineIcon';
import ScheduleIcon from './icons/ScheduleIcon';
import ManagementIcon from './icons/ManagementIcon';
import LeanIcon from './icons/LeanIcon';

interface SidebarProps {
    user: User;
    activeScreen: string;
    onNavigateToHome?: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onUpgradeClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    user,
    activeScreen,
    onNavigateToHome,
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onUpgradeClick,
}) => {
    const showFullMenu = user.role !== 'Executor';
    const isCostModule = activeScreen === 'cost';
    const accentColor = isCostModule ? 'green-600' : 'brand-accent';
    const accentText = isCostModule ? 'text-green-500' : 'text-brand-accent';
    const accentBg = isCostModule ? 'bg-green-600' : 'bg-brand-accent';
    const accentBorder = isCostModule ? 'border-green-600/30' : 'border-brand-accent/30';
    const accentShadow = isCostModule ? 'shadow-green-600/20' : 'shadow-brand-accent/20';

    return (
        <aside className="hidden lg:flex flex-col w-72 bg-[#0a0f18] border-r border-white/5 non-printable transition-all duration-300">
            <div className="p-8 flex-1">
                <div className="flex flex-col mb-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${accentBg} rounded-xl flex items-center justify-center shadow-lg ${accentShadow}`}>
                            <ConstructionIcon className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tighter">LEAN</h1>
                    </div>
                    <p className={`text-[10px] ${accentText} font-black uppercase tracking-[0.2em] ml-[52px] mt-[-4px]`}>
                        SOLUTION • V1.0
                    </p>
                </div>

                <nav className="space-y-2">
                    <h3 className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mb-4 ml-2">
                        {isCostModule ? 'Módulo Financeiro' : 'Menu Principal'}
                    </h3>

                    {onNavigateToHome && (
                        <NavButton
                            icon={
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            }
                            label="Módulos de Gestão"
                            onClick={onNavigateToHome}
                            isCostModule={isCostModule}
                        />
                    )}

                    {!isCostModule ? (
                        <>
                            <NavButton
                                active={activeScreen === 'dashboard'}
                                icon={<ChartIcon className="w-5 h-5" />}
                                label="Painel de Controle"
                                onClick={onNavigateToDashboard}
                                isCostModule={isCostModule}
                            />
                            {showFullMenu && (
                                <>
                                    <NavButton
                                        active={activeScreen === 'baseline'}
                                        icon={<BaselineIcon className="w-5 h-5" />}
                                        label="Linha Base"
                                        onClick={onNavigateToBaseline}
                                        isCostModule={isCostModule}
                                    />
                                    <NavButton
                                        active={activeScreen === 'currentSchedule'}
                                        icon={<ScheduleIcon className="w-5 h-5" />}
                                        label="Cronograma Corrente"
                                        onClick={onNavigateToCurrentSchedule}
                                        isCostModule={isCostModule}
                                    />
                                    <NavButton
                                        active={activeScreen === 'reports'}
                                        icon={<ChartIcon className="w-5 h-5" />}
                                        label="Dashboards"
                                        onClick={onNavigateToReports}
                                        isCostModule={isCostModule}
                                    />
                                    <NavButton
                                        active={activeScreen === 'management'}
                                        icon={<ManagementIcon className="w-5 h-5" />}
                                        label="Painel Gerencial"
                                        onClick={onNavigateToAnalysis}
                                        isCostModule={isCostModule}
                                    />
                                    <NavButton
                                        active={activeScreen === 'lean' || activeScreen === 'restrictions'}
                                        icon={<LeanIcon className="w-5 h-5" />}
                                        label="Sistema LPS"
                                        onClick={onNavigateToLean}
                                        isCostModule={isCostModule}
                                    />
                                    <NavButton
                                        active={activeScreen === 'leanConstruction'}
                                        icon={<LeanIcon className="w-5 h-5 text-cyan-400" />}
                                        label="Lean Construction"
                                        onClick={onNavigateToLeanConstruction}
                                        isCostModule={isCostModule}
                                    />
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Cost module items could be added here if needed, but for now we focus on Planning consistency */}
                            <p className="text-xs text-brand-med-gray px-4 py-2">Módulo de Custos Ativo</p>
                        </>
                    )}
                </nav>
            </div>

            <div className="p-6 bg-brand-darkest/50 animate-slide-up animate-stagger-4 mt-auto">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 smooth-transition group cursor-pointer hover-shine relative overflow-hidden">
                    <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center text-white font-black shadow-lg group-hover:rotate-6 smooth-transition`}>
                        {user.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate leading-none">{user.fullName}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-bold text-brand-med-gray uppercase tracking-wider">{user.role}</p>
                            <button
                                onClick={onUpgradeClick}
                                className={`text-[8px] ${isCostModule ? 'bg-green-600/20 text-green-500' : 'bg-brand-accent/20 text-brand-accent'} border ${accentBorder} px-1.5 py-0.5 rounded hover:${accentBg} hover:text-white transition-all font-black uppercase`}
                            >
                                Upgrade
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const NavButton: React.FC<{
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    active?: boolean,
    isCostModule?: boolean
}> = ({ icon, label, onClick, active, isCostModule }) => {
    const activeBg = isCostModule ? 'bg-green-600' : 'bg-brand-accent';
    const activeShadow = isCostModule ? 'shadow-green-600/20' : 'shadow-brand-accent/20';
    const iconColor = isCostModule ? 'text-green-500/70' : 'text-brand-accent/70';

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${active
                ? `${activeBg} text-white shadow-lg ${activeShadow} font-bold`
                : 'text-brand-med-gray hover:bg-white/5 hover:text-white font-medium'
                }`}
        >
            <div className={`transition-transform duration-300 group-hover:scale-110 ${active ? 'text-white' : iconColor}`}>
                {icon}
            </div>
            <span className="text-sm tracking-tight whitespace-nowrap">{label}</span>
        </button>
    );
};

export default Sidebar;
