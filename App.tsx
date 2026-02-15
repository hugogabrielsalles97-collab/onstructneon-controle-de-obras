import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import Dashboard from './components/Dashboard';
import ReportsPage from './components/ReportsPage';
import BaselinePage from './components/BaselinePage';
import CurrentSchedulePage from './components/CurrentSchedulePage';
import ManagementPage from './components/ManagementPage';
import LeanPage from './components/LeanPage';
import LeanConstructionPage from './components/LeanConstructionPage';
import RestrictionsAnalysisPage from './components/RestrictionsAnalysisPage';
import TaskModal from './components/TaskModal';
import RdoModal from './components/RdoModal';
import AIAssistant from './components/AIAssistant';
import UpgradeModal from './components/UpgradeModal';
import Toast from './components/Toast';
import ConstructionIcon from './components/icons/ConstructionIcon';
import { Task, Restriction } from './types';
import { DataProvider, useData } from './context/DataProvider';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

type Screen = 'login' | 'register' | 'dashboard' | 'reports' | 'baseline' | 'currentSchedule' | 'management' | 'lean' | 'leanConstruction' | 'restrictions';

const AppContent: React.FC = () => {
  const {
    session, currentUser, allUsers, tasks, baselineTasks, restrictions, isLoading,
    saveTask, signOut, saveRestriction, updateRestriction, deleteRestriction
  } = useData();
  const [screen, setScreen] = useState<Screen>('login');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRdoModalOpen, setIsRdoModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleOpenTaskModal = (task: Task | null) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setEditingTask(null);
    setIsTaskModalOpen(false);
  };

  const handleOpenRdoModal = () => setIsRdoModalOpen(true);
  const handleCloseRdoModal = () => setIsRdoModalOpen(false);

  const sendWhatsAppNotification = (task: Task) => {
    const responsibleUser = allUsers.find(u => u.fullName === task.assignee);
    if (!responsibleUser || !responsibleUser.whatsapp) {
      showToast(`Responsável "${task.assignee}" não possui WhatsApp cadastrado.`, 'error');
      return;
    }

    const phoneNumber = responsibleUser.whatsapp.replace(/\D/g, '');

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

    const message = `
*Nova Tarefa Atribuída* 🏗️

Olá, *${task.assignee}*! Uma nova tarefa foi planejada para você no Lean Solution.

*Tarefa:* ${task.title}
*Disciplina:* ${task.discipline} / ${task.level}
*Local:* ${task.location}${task.corte ? ` (${task.corte})` : ''}${task.support ? ` - ${task.support}` : ''}
*Descrição:* ${task.description || 'N/A'}

*Prazo Planejado:*
*Início:* ${formatDate(task.startDate)}
*Fim:* ${formatDate(task.dueDate)}

*Quantidade:* ${task.quantity} ${task.unit}

Por favor, acesse o aplicativo para mais detalhes.
    `.trim();

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
    showToast('Notificação do WhatsApp pronta para envio!', 'success');
  };

  const handleSaveTaskWrapper = async (task: Task) => {
    const { success, error } = await saveTask(task);

    if (success) {
      showToast(editingTask ? 'Tarefa atualizada!' : 'Tarefa criada com sucesso!', 'success');
      if (!editingTask) sendWhatsAppNotification(task);
    } else {
      showToast(`Erro ao salvar tarefa: ${error}`, 'error');
    }
    handleCloseTaskModal();
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#020202] overflow-hidden font-sans selection:bg-brand-accent selection:text-white">
          {/* Dynamic Background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1f2e] via-[#050505] to-[#000000] z-0"></div>

          {/* Decorative Orbs */}
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-accent/5 rounded-full blur-[100px] animate-pulse pointer-events-none z-0"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[80px] pointer-events-none z-0 delay-700"></div>

          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay pointer-events-none"></div>

          {/* Central Animation */}
          <div className="relative z-10 flex flex-col items-center animate-fade-in">
            <div className="relative mb-8 group">
              <div className="absolute inset-0 bg-brand-accent/30 blur-2xl rounded-full animate-pulse"></div>
              <div className="relative bg-[#111827]/80 p-6 rounded-2xl border border-brand-accent/20 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(227,90,16,0.3)] ring-1 ring-white/10">
                <ConstructionIcon className="w-16 h-16 text-brand-accent drop-shadow-[0_0_15px_rgba(227,90,16,0.5)] animate-bounce" style={{ animationDuration: '3s' }} />
              </div>

              {/* Engineering Lines Animation */}
              <div className="absolute -left-12 top-1/2 w-8 h-[1px] bg-brand-accent/50 animate-[ping_2s_linear_infinite]"></div>
              <div className="absolute -right-12 top-1/2 w-8 h-[1px] bg-brand-accent/50 animate-[ping_2s_linear_infinite] delay-300"></div>
            </div>

            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic mb-1">
              Lean <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-orange-400">Solution</span>
            </h1>

            <p className="text-[10px] text-brand-med-gray font-bold uppercase tracking-[0.4em] mb-10 opacity-70">
              Engenharia de Alta Performance
            </p>

            {/* Progress Bar */}
            <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden relative">
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-accent to-orange-500 w-1/2 animate-[shimmer_1.5s_infinite_linear]" style={{ backgroundImage: 'linear-gradient(to right, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
              <div className="absolute top-0 left-0 h-full bg-brand-accent animate-[indeterminate_1.5s_infinite_ease-in-out] w-full origin-left scale-x-0"></div>
            </div>

            <p className="mt-4 text-xs text-brand-med-gray font-mono animate-pulse">
              Carregando módulos...
            </p>
          </div>
        </div>
      );
    }

    if (!currentUser) {
      switch (screen) {
        case 'register': return <RegisterScreen onNavigateToLogin={() => setScreen('login')} showToast={showToast} />;
        case 'login':
        default: return <LoginScreen onNavigateToRegister={() => setScreen('register')} showToast={showToast} onVisitorLogin={() => { }} />;
      }
    }

    const navigationProps = {
      onNavigateToDashboard: () => setScreen('dashboard'),
      onNavigateToReports: () => setScreen('reports'),
      onNavigateToBaseline: () => setScreen('baseline'),
      onNavigateToCurrentSchedule: () => setScreen('currentSchedule'),
      onNavigateToAnalysis: () => setScreen('management'),
      onNavigateToLean: () => setScreen('lean'),
      onNavigateToLeanConstruction: () => setScreen('leanConstruction'),
      onUpgradeClick: () => setIsUpgradeModalOpen(true),
    };

    switch (screen) {
      case 'dashboard': return <Dashboard onOpenModal={handleOpenTaskModal} onOpenRdoModal={handleOpenRdoModal} {...navigationProps} showToast={showToast} />;
      case 'reports': return <ReportsPage {...navigationProps} showToast={showToast} />;
      case 'baseline': return <BaselinePage {...navigationProps} showToast={showToast} />;
      case 'currentSchedule': return <CurrentSchedulePage {...navigationProps} showToast={showToast} />;
      case 'management': return <ManagementPage {...navigationProps} showToast={showToast} />;
      case 'leanConstruction': return <LeanConstructionPage {...navigationProps} showToast={showToast} />;
      case 'lean': return (
        <LeanPage
          {...navigationProps}
          onNavigateToRestrictions={() => setScreen('restrictions')}
          onSaveRestriction={saveRestriction}
          onUpdateRestriction={updateRestriction}
          onDeleteRestriction={deleteRestriction}
          restrictions={restrictions}
          showToast={showToast}
        />
      );
      case 'restrictions': return (
        <RestrictionsAnalysisPage
          user={currentUser}
          restrictions={restrictions}
          baselineTasks={baselineTasks}
          onLogout={async () => {
            const { success, error } = await signOut();
            if (!success && error) showToast(`Erro ao sair: ${error}`, 'error');
            setScreen('login');
          }}
          {...navigationProps}
          onNavigateToRestrictions={() => setScreen('restrictions')}
          onUpdateRestriction={updateRestriction}
          onDeleteRestriction={deleteRestriction}
        />
      );
      default: return <Dashboard onOpenModal={handleOpenTaskModal} onOpenRdoModal={handleOpenRdoModal} {...navigationProps} showToast={showToast} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-darkest text-gray-100">
      {renderContent()}
      {isTaskModalOpen && currentUser && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={handleCloseTaskModal}
          onSave={handleSaveTaskWrapper}
          task={editingTask}
          tasks={tasks}
          baselineTasks={baselineTasks}
          user={currentUser}
          allUsers={allUsers}
        />
      )}
      {isRdoModalOpen && (
        <RdoModal
          isOpen={isRdoModalOpen}
          onClose={handleCloseRdoModal}
          tasks={tasks}
        />
      )}
      {currentUser && (
        <AIAssistant tasks={tasks} baselineTasks={baselineTasks} />
      )}
      {isUpgradeModalOpen && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          showToast={showToast}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {useData().isDevToolsOpen && <ReactQueryDevtools initialIsOpen={true} />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
};

export default App;
