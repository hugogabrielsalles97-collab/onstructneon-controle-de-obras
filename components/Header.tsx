
import React, { useState } from 'react';
import { User } from '../types';
import LogoutIcon from './icons/LogoutIcon';
import ConstructionIcon from './icons/ConstructionIcon';
import ChartIcon from './icons/ChartIcon';
import BaselineIcon from './icons/BaselineIcon';
import ScheduleIcon from './icons/ScheduleIcon';
import ManagementIcon from './icons/ManagementIcon';
import LeanIcon from './icons/LeanIcon';
import LeanConstructionIcon from './icons/LeanConstructionIcon';
import XIcon from './icons/XIcon';
import UserManagementModal from './UserManagementModal';
import Toast from './Toast';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onNavigateToHome?: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToBaseline?: () => void;
  onNavigateToCurrentSchedule?: () => void;
  onNavigateToAnalysis?: () => void;
  onNavigateToLean?: () => void;
  onNavigateToLeanConstruction?: () => void;
  onNavigateToCost?: () => void;
  onUpgradeClick?: () => void;
  activeScreen?: string;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onNavigateToHome,
  onNavigateToDashboard,
  onNavigateToReports,
  onNavigateToBaseline,
  onNavigateToCurrentSchedule,
  onNavigateToAnalysis,
  onNavigateToLean,
  onNavigateToLeanConstruction,
  onNavigateToCost,
  onUpgradeClick,
  activeScreen = 'dashboard'
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showFullMenu = user.role !== 'Executor';

  const isCostModule = activeScreen === 'cost';

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Painel de Controle', icon: <ChartIcon className="w-5 h-5" />, onClick: onNavigateToDashboard, show: true },
    { id: 'baseline', label: 'Linha Base', icon: <BaselineIcon className="w-5 h-5" />, onClick: onNavigateToBaseline, show: showFullMenu },
    { id: 'currentSchedule', label: 'Cronograma Corrente', icon: <ScheduleIcon className="w-5 h-5" />, onClick: onNavigateToCurrentSchedule, show: showFullMenu },
    { id: 'reports', label: 'Dashboards', icon: <ChartIcon className="w-5 h-5" />, onClick: onNavigateToReports, show: showFullMenu },
    { id: 'management', label: 'Painel Gerencial', icon: <ManagementIcon className="w-5 h-5" />, onClick: onNavigateToAnalysis, show: showFullMenu },
    { id: 'lean', label: 'Sistema LPS', icon: <LeanIcon className="w-5 h-5" />, onClick: onNavigateToLean, show: showFullMenu },
    { id: 'leanConstruction', label: 'Lean Construction', icon: <LeanConstructionIcon className="w-5 h-5 text-cyan-400" />, onClick: onNavigateToLeanConstruction, show: showFullMenu },
  ];

  const handleMenuClick = (onClick?: () => void) => {
    if (onClick) {
      onClick();
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      <header className="bg-[#0a0f18]/60 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 non-printable">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {/* Botão de Menu (Mobile) */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden mr-4 p-2 hover:bg-white/5 rounded-lg transition-colors text-brand-med-gray hover:text-white"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>

            {onNavigateToHome && (
              <button
                onClick={onNavigateToHome}
                className={`mr-6 p-2 bg-white/5 border border-white/5 rounded-xl transition-all duration-300 flex items-center gap-2 group ${isCostModule ? 'hover:bg-green-600/20 hover:border-green-600/30 hover:text-green-500' : 'hover:bg-brand-accent/20 hover:border-brand-accent/30 hover:text-brand-accent'} text-brand-med-gray`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider hidden md:inline">Módulos</span>
              </button>
            )}

            <button
              onClick={onNavigateToHome}
              className={`flex items-center transition-opacity ${onNavigateToHome ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
              disabled={!onNavigateToHome}
            >
              <ConstructionIcon className={`h-6 w-6 ${isCostModule ? 'text-green-500' : 'text-brand-accent'}`} />
              <span className="ml-2.5 text-lg font-black text-white italic tracking-tighter uppercase">LEAN SOLUTION</span>
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end leading-none text-right">
              <span className="text-[10px] text-brand-med-gray font-black uppercase tracking-widest mb-1">{user.fullName}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onUpgradeClick}
                  className={`text-[9px] ${isCostModule ? 'bg-green-600/10 text-green-500 border-green-600/30' : 'bg-brand-accent/10 text-brand-accent border-brand-accent/30'} px-1.5 py-0.5 rounded hover:text-white transition-all uppercase font-bold`}
                >
                  Upgrade
                </button>
                {user.role === 'Master' && (
                  <button
                    onClick={() => setIsUserManagementOpen(true)}
                    className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded hover:bg-purple-500 hover:text-white transition-all uppercase font-bold animate-pulse"
                  >
                    Admin
                  </button>
                )}
                <span className="text-sm font-black text-white italic tracking-tight uppercase">{user.role}</span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-white/5 text-brand-med-gray px-4 py-2 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 border border-white/5"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden overflow-hidden">
          <div className="absolute inset-0 bg-brand-darkest/95 backdrop-blur-md" onClick={() => setIsMenuOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#0a0f18] border-r border-white/10 p-6 flex flex-col shadow-2xl animate-slide-right">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <ConstructionIcon className={`w-5 h-5 ${isCostModule ? 'text-green-500' : 'text-brand-accent'}`} />
                <span className="text-lg font-black text-white italic tracking-tighter uppercase">Navegação</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 text-brand-med-gray"><XIcon className="w-6 h-6" /></button>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto">
              {menuItems.filter(item => item.show).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item.onClick)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeScreen === item.id ? (isCostModule ? 'bg-green-600' : 'bg-brand-accent') + ' text-white font-bold' : 'text-brand-med-gray hover:bg-white/5 hover:text-white'}`}
                >
                  <div className={activeScreen === item.id ? 'text-white' : (isCostModule ? 'text-green-500' : 'text-brand-accent')}>{item.icon}</div>
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}

              {!isCostModule && onNavigateToCost && user.role === 'Master' && (
                <button
                  onClick={() => handleMenuClick(onNavigateToCost)}
                  className="w-full flex items-center justify-between px-4 py-3.5 mt-4 bg-green-600/10 border border-green-600/20 rounded-xl group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white">💰</div>
                    <span className="text-xs font-bold text-white uppercase">Módulo de Custos</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 group-hover:translate-x-1 transition-transform">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/5">
              <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-500 py-3 rounded-xl font-bold border border-red-500/20">
                <LogoutIcon className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isUserManagementOpen && <UserManagementModal onClose={() => setIsUserManagementOpen(false)} showToast={showToast} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default Header;
