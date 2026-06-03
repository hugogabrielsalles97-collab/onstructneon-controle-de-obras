
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
import HistoryIcon from './icons/HistoryIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import UserManagementModal from './UserManagementModal';
import ChangePasswordModal from './ChangePasswordModal';
import Toast from './Toast';
import { useData } from '../context/DataProvider';
import { useNotifications, markNotificationAsRead, clearAllNotifications } from '../hooks/dataHooks';

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
  onNavigateToMonitoringControl?: () => void;
  onNavigateToPodcast?: () => void;
  onNavigateToCost?: () => void;
  onNavigateToCheckoutSummary?: () => void;
  onNavigateToOrgChart?: () => void;
  onNavigateToOrgSummary?: () => void;
  onNavigateToWarRoom?: () => void;
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
  onNavigateToMonitoringControl,
  onNavigateToPodcast,
  onNavigateToCost,
  onNavigateToCheckoutSummary,
  onNavigateToOrgChart,
  onNavigateToOrgSummary,
  onNavigateToWarRoom,
  onUpgradeClick,
  activeScreen = 'dashboard'
}) => {
  const { allUsers } = useData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const isWarRoomOnlyProfile = user.role === 'Visualizador';
  const showFullMenu = user.role !== 'Executor' && !isWarRoomOnlyProfile;

  const { data: notifications = [], refetch: refetchNotifications } = useNotifications(user.role === 'Master');
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = async (notifId: string, taskId: string) => {
    await markNotificationAsRead(notifId);
    refetchNotifications();
    setIsNotificationsOpen(false);
    
    // Using deep link URL to open TaskModal directly
    const newUrl = window.location.origin + window.location.pathname + `?taskId=${taskId}&action=reviewObs`;
    window.location.href = newUrl;
  };

  const handleClearAllNotifications = async () => {
    await clearAllNotifications();
    refetchNotifications();
  };

  const isCostModule = activeScreen === 'cost';

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isOrgModule = activeScreen === 'orgSummary' || activeScreen === 'orgChart';

  const menuItems = [
    { id: 'dashboard', label: 'Programação Semanal', icon: <ChartIcon className="w-5 h-5" />, onClick: onNavigateToDashboard, show: !isOrgModule },
    { id: 'leanConstruction', label: 'Lean Construction', icon: <LeanConstructionIcon className="w-5 h-5 text-cyan-400" />, onClick: onNavigateToLeanConstruction, show: showFullMenu && !isOrgModule },
    { id: 'lean', label: 'Sistema LPS', icon: <LeanIcon className="w-5 h-5" />, onClick: onNavigateToLean, show: showFullMenu && !isOrgModule },
    { id: 'orgSummary', label: 'Resumo Organograma', icon: <BriefcaseIcon className="w-5 h-5 text-cyan-400" />, onClick: onNavigateToOrgSummary, show: isOrgModule },
    { id: 'orgChart', label: 'Árvore Organograma', icon: <ManagementIcon className="w-5 h-5 text-indigo-400" />, onClick: onNavigateToOrgChart, show: showFullMenu && isOrgModule },

    { id: 'management', label: 'Painel Gerencial', icon: <ManagementIcon className="w-5 h-5" />, onClick: onNavigateToAnalysis, show: showFullMenu && !isOrgModule },
    { id: 'baseline', label: 'Linha Base', icon: <BaselineIcon className="w-5 h-5" />, onClick: onNavigateToBaseline, show: showFullMenu && !isOrgModule },
    { id: 'currentSchedule', label: 'Cronograma Corrente', icon: <ScheduleIcon className="w-5 h-5" />, onClick: onNavigateToCurrentSchedule, show: showFullMenu && !isOrgModule },
    {
      id: 'monitoringControl', label: 'Monitoramento e Controle', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-indigo-400">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ), onClick: onNavigateToMonitoringControl, show: showFullMenu && !isOrgModule
    },
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
              <span className="ml-2.5 text-lg font-black text-white italic tracking-tighter uppercase">ELOS</span>
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end leading-none text-right">
              <span className="text-[10px] text-brand-med-gray font-black uppercase tracking-widest mb-1">{user.fullName}</span>
              <div className="flex items-center gap-2">
                {!isWarRoomOnlyProfile && (
                <button
                  onClick={onUpgradeClick}
                  className={`text-[9px] ${isCostModule ? 'bg-green-600/10 text-green-500 border-green-600/30' : 'bg-brand-accent/10 text-brand-accent border-brand-accent/30'} px-1.5 py-0.5 rounded hover:text-white transition-all uppercase font-bold`}
                >
                  Upgrade
                </button>
                )}
                <button
                  onClick={() => setIsChangePasswordOpen(true)}
                  className={`text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded hover:bg-cyan-500 hover:text-white transition-all uppercase font-bold`}
                >
                  Senha
                </button>
                {user.role === 'Master' && (
                  <button
                    onClick={() => setIsUserManagementOpen(true)}
                    className="relative text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded hover:bg-purple-500 hover:text-white transition-all uppercase font-bold animate-pulse"
                  >
                    Admin
                    {allUsers.some(u => u.is_approved === false) && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f18] animate-bounce"></span>
                    )}
                  </button>
                )}
                <span className="text-sm font-black text-white italic tracking-tight uppercase">{user.role}</span>
              </div>
            </div>

            {user.role === 'Master' && (
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-2 text-brand-med-gray hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/5"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={unreadCount > 0 ? "text-brand-accent animate-[shake_0.5s_ease-in-out_infinite] animate-pulse" : ""}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f18] shadow-[0_0_5px_rgba(239,68,68,0.8)]"></span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-slide-up">
                    <div className="p-3 bg-brand-darkest/80 border-b border-white/10 flex justify-between items-center">
                      <span className="text-[10px] font-black tracking-widest uppercase text-white">Notificações</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-brand-med-gray">{notifications.length} itens</span>
                        {notifications.length > 0 && (
                          <button
                            onClick={handleClearAllNotifications}
                            className="text-[9px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/20 transition-all duration-200"
                          >
                            Limpar Tudo
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-brand-med-gray text-xs">Nenhuma notificação recente.</div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotificationClick(n.id, n.task_id)}
                            className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-brand-accent/5 relative' : ''}`}
                          >
                            {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-accent"></div>}
                            <p className="text-xs text-white font-bold mb-1 truncate">{n.task_title}</p>
                            <p className="text-[10px] text-brand-med-gray">{n.message}</p>
                            <p className="text-[8px] text-white/40 font-mono mt-2">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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
      {isChangePasswordOpen && <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} showToast={showToast} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default Header;
