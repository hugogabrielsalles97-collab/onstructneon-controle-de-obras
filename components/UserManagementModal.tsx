
import React, { useState } from 'react';
import { useData } from '../context/DataProvider';
import { User } from '../types';
import XIcon from './icons/XIcon';
import DeleteIcon from './icons/DeleteIcon';
import EditIcon from './icons/EditIcon';
import CheckIcon from './icons/CheckIcon';
import ConfirmModal from './ConfirmModal';

interface UserManagementModalProps {
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose, showToast }) => {
    const { allUsers, updateUser, deleteUser, currentUser } = useData();
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<User>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; userId: string | null }>({ isOpen: false, userId: null });
    const [isDeleting, setIsDeleting] = useState(false);

    const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users');

    const handleEditClick = (user: User) => {
        setEditingUserId(user.id);
        setEditForm({ fullName: user.fullName, role: user.role, email: user.email });
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
        setEditForm({});
    };

    const handleSaveEdit = async (userId: string) => {
        if (!editForm.fullName || !editForm.role) {
            showToast('Nome e Cargo são obrigatórios.', 'error');
            return;
        }

        const { success, error } = await updateUser(userId, editForm);
        if (success) {
            showToast('Usuário atualizado com sucesso.', 'success');
            setEditingUserId(null);
        } else {
            showToast(`Erro ao atualizar: ${error}`, 'error');
        }
    };

    const handleApproveUser = async (user: User) => {
        const { success, error } = await updateUser(user.id, { is_approved: true });
        if (success) {
            showToast(`Usuário ${user.fullName} aprovado com sucesso!`, 'success');
        } else {
            showToast(`Erro ao aprovar: ${error}`, 'error');
        }
    };

    const handleDeleteClick = (userId: string) => {
        setConfirmModal({ isOpen: true, userId });
    };

    const handleConfirmDelete = async () => {
        if (!confirmModal.userId) return;
        setIsDeleting(true);
        const { success, error } = await deleteUser(confirmModal.userId);
        if (success) {
            showToast('Usuário removido.', 'success');
            setConfirmModal({ isOpen: false, userId: null });
        } else {
            showToast(`Erro ao remover: ${error}`, 'error');
        }
        setIsDeleting(false);
    };

    const approvedUsers = allUsers.filter(u => u.is_approved !== false);
    const pendingUsers = allUsers.filter(u => u.is_approved === false);

    const filteredUsers = (activeTab === 'users' ? approvedUsers : pendingUsers).filter(u =>
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0a0f18] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111827]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-accent/10 rounded-lg">
                            <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Gestão de Usuários</h2>
                            <p className="text-xs text-gray-400">Administração total de perfis e acessos.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 bg-[#111827] border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeTab === 'users' ? 'bg-brand-accent text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Usuários Ativos ({approvedUsers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all relative ${activeTab === 'requests' ? 'bg-brand-accent text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Solicitações ({pendingUsers.length})
                        {pendingUsers.length > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                    </button>
                </div>

                <div className="p-4 border-b border-white/5 bg-[#0a0f18]">
                    <input
                        type="text"
                        placeholder="Buscar por nome, email ou cargo..."
                        className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 outline-none text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0a0f18]">
                    <div className="grid grid-cols-1 gap-4">
                        {filteredUsers.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                {activeTab === 'users' ? 'Nenhum usuário ativo encontrado.' : 'Nenhuma solicitação pendente.'}
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <div key={user.id} className={`bg-[#111827] rounded-xl p-4 border ${editingUserId === user.id ? 'border-brand-accent/50 bg-brand-accent/5' : 'border-white/5 hover:border-white/10'} transition-all`}>
                                    {editingUserId === user.id ? (
                                        <div className="flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex-1 w-full">
                                                <label className="text-[10px] uppercase font-bold text-brand-med-gray mb-1 block">Nome Completo</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-[#0a0f18] border border-white/10 rounded-lg p-2 text-white text-sm"
                                                    value={editForm.fullName || ''}
                                                    onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                                                />
                                            </div>
                                            <div className="w-full md:w-1/3">
                                                <label className="text-[10px] uppercase font-bold text-brand-med-gray mb-1 block">Cargo</label>
                                                <select
                                                    className="w-full bg-[#0a0f18] border border-white/10 rounded-lg p-2 text-white text-sm"
                                                    value={editForm.role || ''}
                                                    onChange={e => setEditForm({ ...editForm, role: e.target.value as User['role'] })}
                                                >
                                                    <option value="Master">Master</option>
                                                    <option value="Gerenciador">Gerenciador</option>
                                                    <option value="Executor">Executor</option>
                                                    <option value="Planejador">Planejador</option>
                                                    <option value="Visitante">Visitante</option>
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSaveEdit(user.id)} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg" title="Salvar"><CheckIcon className="w-5 h-5" /></button>
                                                <button onClick={handleCancelEdit} className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg" title="Cancelar"><XIcon className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-brand-darkest border border-white/10 flex items-center justify-center text-brand-accent font-bold text-lg">
                                                    {user.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-white font-bold">{user.fullName} {currentUser?.id === user.id && <span className="text-[10px] bg-brand-accent text-white px-1.5 py-0.5 rounded ml-2">VOCÊ</span>}</h3>
                                                        {activeTab === 'requests' && <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-bold uppercase">Pendente</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500">{user.username}</p>
                                                    {user.whatsapp && <p className="text-[10px] text-brand-med-gray">Whats: {user.whatsapp}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${user.role === 'Master' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    user.role === 'Gerenciador' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                                <div className="flex gap-2">
                                                    {activeTab === 'requests' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleApproveUser(user)}
                                                                className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white px-3 py-1.5 rounded-lg border border-green-500/20 transition-all font-bold text-xs"
                                                            >
                                                                <CheckIcon className="w-4 h-4" />
                                                                Aprovar
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(user.id)}
                                                                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 rounded-lg border border-red-500/20 transition-all font-bold text-xs"
                                                            >
                                                                <DeleteIcon className="w-4 h-4" />
                                                                Recusar
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleEditClick(user)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                            {currentUser?.id !== user.id && (
                                                                <button onClick={() => handleDeleteClick(user.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><DeleteIcon className="w-4 h-4" /></button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 bg-[#111827] border-t border-white/5 flex justify-between items-center rounded-b-2xl">
                    <p className="text-[10px] text-gray-500">Total listados: {filteredUsers.length}</p>
                    {activeTab === 'requests' && pendingUsers.length > 0 && (
                        <p className="text-[10px] text-brand-accent font-bold animate-pulse">Solicitações aguardando ação!</p>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={handleConfirmDelete}
                title="Remover Usuário"
                message="Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita."
                confirmText="Sim, Remover"
                cancelText="Cancelar"
                type="danger"
                isLoading={isDeleting}
            />
        </div>
    );
};

export default UserManagementModal;
