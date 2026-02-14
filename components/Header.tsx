
import React from 'react';
import { User } from '../types';
import LogoutIcon from './icons/LogoutIcon';
import ConstructionIcon from './icons/ConstructionIcon';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-[#0a0f18]/60 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 non-printable">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center lg:hidden">
          <ConstructionIcon className="h-6 w-6 text-brand-accent" />
          <span className="ml-2.5 text-lg font-black text-white italic tracking-tighter">LEAN SOLUTION</span>
        </div>

        <div className="flex-1 flex items-center justify-end gap-6 text-sm">
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-[10px] text-brand-med-gray font-black uppercase tracking-widest mb-1">Unidade Serra das Araras</span>
            <span className="text-sm font-black text-white italic tracking-tight">EGTC - NSA</span>
          </div>

          <div className="h-8 w-px bg-white/5 hidden sm:block"></div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-white/5 text-brand-med-gray px-4 py-2 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 border border-white/5"
            title="Sair da Plataforma"
          >
            <span className="text-xs font-bold hidden sm:inline">Encerrar Sessão</span>
            <LogoutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
