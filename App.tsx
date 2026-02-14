import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import Dashboard from './components/Dashboard';
import ReportsPage from './components/ReportsPage';
import BaselinePage from './components/BaselinePage';
import ManagementPage from './components/ManagementPage';
import LeanPage from './components/LeanPage';
import TaskModal from './components/TaskModal';
import RdoModal from './components/RdoModal';
import AIAssistant from './components/AIAssistant';
import Toast from './components/Toast';
import { Task } from './types';
import { DataProvider, useData } from './context/DataProvider';

type Screen = 'login' | 'register' | 'dashboard' | 'reports' | 'baseline' | 'management' | 'lean';

const AppContent: React.FC = () => {
  const { session, currentUser, allUsers, tasks, baselineTasks, isLoading, saveTask, loginAsVisitor } = useData();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRdoModalOpen, setIsRdoModalOpen] = useState(false);
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

  const handleVisitorLoginWrapper = () => {
    loginAsVisitor();
    setScreen('dashboard');
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-screen text-brand-accent text-xl">Carregando...</div>;
    }
    if (!session && !currentUser) {
      switch (screen) {
        case 'login': return <LoginScreen onNavigateToRegister={() => setScreen('register')} onVisitorLogin={handleVisitorLoginWrapper} showToast={showToast} />;
        case 'register': return <RegisterScreen onNavigateToLogin={() => setScreen('login')} showToast={showToast} />;
        default: return <LoginScreen onNavigateToRegister={() => setScreen('register')} onVisitorLogin={handleVisitorLoginWrapper} showToast={showToast} />;
      }
    }

    if (currentUser) {
      const isPlanner = currentUser.role === 'Planejador';
      const currentScreen = isPlanner ? screen : 'dashboard';

      const navigationProps = {
        onNavigateToDashboard: () => setScreen('dashboard'),
        onNavigateToReports: () => setScreen('reports'),
        onNavigateToBaseline: () => setScreen('baseline'),
        onNavigateToAnalysis: () => setScreen('management'),
        onNavigateToLean: () => setScreen('lean'),
      };

      switch (currentScreen) {
        case 'dashboard': return <Dashboard onOpenModal={handleOpenTaskModal} onOpenRdoModal={handleOpenRdoModal} {...navigationProps} showToast={showToast} />;
        case 'reports': return <ReportsPage {...navigationProps} showToast={showToast} />;
        case 'baseline': return <BaselinePage {...navigationProps} showToast={showToast} />;
        case 'management': return <ManagementPage {...navigationProps} showToast={showToast} />;
        case 'lean': return <LeanPage {...navigationProps} showToast={showToast} />;
        default: return <Dashboard onOpenModal={handleOpenTaskModal} onOpenRdoModal={handleOpenRdoModal} {...navigationProps} showToast={showToast} />;
      }
    }

    return <LoginScreen onNavigateToRegister={() => setScreen('register')} onVisitorLogin={handleVisitorLoginWrapper} showToast={showToast} />;
  }

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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
