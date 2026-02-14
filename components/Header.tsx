
import React, { useState } from 'react';
import { User } from '../types';
import LogoutIcon from './icons/LogoutIcon';
import ConstructionIcon from './icons/ConstructionIcon';
import ChartIcon from './icons/ChartIcon';
import BaselineIcon from './icons/BaselineIcon';
import ManagementIcon from './icons/ManagementIcon';
import LeanIcon from './icons/LeanIcon';
import XIcon from './icons/XIcon';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToBaseline?: () => void;
  onNavigateToAnalysis?: () => void;
  onNavigateToLean?: () => void;
  activeScreen?: string;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onNavigateToDashboard,
  onNavigateToReports,
  onNavigateToBaseline,
  onNavigateToAnalysis,
  onNavigateToLean,
  activeScreen = 'dashboard'
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPlanner = user.role === 'Planejador';

  const menuItems = [
    { id: 'dashboard', label: 'Painel de Controle', icon: <ChartIcon className="w-5 h-5" />, onClick: onNavigateToDashboard, show: true },
    { id: 'baseline', label: 'Linha Base', icon: <BaselineIcon className="w-5 h-5" />, onClick: onNavigateToBaseline, show: isPlanner },
    { id: 'reports', label: 'Dashboards', icon: <ChartIcon className="w-5 h-5" />, onClick: onNavigateToReports, show: isPlanner },
    { id: 'management', label: 'Painel Gerencial', icon: <ManagementIcon className="w-5 h-5" />, onClick: onNavigateToAnalysis, show: isPlanner },
    { id: 'lean', label: 'Sistema Lean', icon: <LeanIcon className="w-5 h-5" />, onClick: onNavigateToLean, show: isPlanner },
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
            {/* Botão de Menu (Mobile) - 3 Pontinhos */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden mr-4 p-2 hover:bg-white/5 rounded-lg transition-colors text-brand-med-gray hover:text-white"
              aria-label="Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <circle cx="12" cy="5" r="1" fill="currentColor" />
                <circle cx="12" cy="19" r="1" fill="currentColor" />
              </svg>
            </button>

            <div className="flex items-center">
              <ConstructionIcon className="h-6 w-6 text-brand-accent" />
              <span className="ml-2.5 text-lg font-black text-white italic tracking-tighter">LEAN SOLUTION</span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-6 text-sm">
            <div className="hidden sm:flex flex-col items-end leading-none text-right">
              <span className="text-[10px] text-brand-med-gray font-black uppercase tracking-widest mb-1">Unidade Serra das Araras</span>
              <span className="text-sm font-black text-white italic tracking-tight uppercase">EGTC - NSA</span>
            </div>

            <div className="h-8 w-px bg-white/5 hidden sm:block"></div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-white/5 text-brand-med-gray px-3 sm:px-4 py-2 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 border border-white/5"
              title="Sair da Plataforma"
            >
              <span className="text-xs font-bold hidden sm:inline">Sair</span>
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Overlay do Menu Mobile */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden overflow-hidden">
          <div
            className="absolute inset-0 bg-brand-darkest/95 backdrop-blur-md animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#0a0f18] border-r border-white/10 p-6 flex flex-col shadow-2xl animate-slide-right">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <ConstructionIcon className="w-5 h-5 text-brand-accent" />
                <span className="text-lg font-black text-white italic tracking-tighter">NAVEGAÇÃO</span>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg text-brand-med-gray transition-colors"
                aria-label="Fechar Menu"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <nav className="flex-1 space-y-2">
              <h3 className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mb-4 ml-2">Ir para:</h3>
              {menuItems.filter(item => item.show).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item.onClick)}
                  disabled={activeScreen === item.id}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeScreen === item.id
                      ? 'bg-brand-accent text-white font-bold shadow-lg shadow-brand-accent/20'
                      : 'text-brand-med-gray hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <div className={activeScreen === item.id ? 'text-white' : 'text-brand-accent'}>
                    {item.icon}
                  </div>
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-brand-accent flex items-center justify-center text-white font-black">
                  {user.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate leading-none">{user.fullName}</p>
                  <p className="text-[10px] font-bold text-brand-med-gray mt-1 uppercase tracking-wider">{user.role}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-500 py-3 rounded-xl font-bold border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
              >
                <LogoutIcon className="w-4 h-4" />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
