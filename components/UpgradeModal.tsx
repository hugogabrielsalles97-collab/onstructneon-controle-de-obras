import React, { useState } from 'react';
import { User } from '../types';
import { useData } from '../context/DataProvider';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const TOKENS: Record<'Master' | 'Planejador' | 'Gerenciador' | 'Executor', string> = {
    'Master': 'admin',
    'Planejador': 'planning',
    'Gerenciador': 'manager',
    'Executor': 'production',
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, showToast }) => {
    const { currentUser, upgradeRole } = useData();
    const [targetRole, setTargetRole] = useState<User['role']>('Planejador');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen || !currentUser) return null;

    const handleUpgrade = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (TOKENS[targetRole] !== token) {
            showToast('Token inválido para o perfil selecionado.', 'error');
            setLoading(false);
            return;
        }

        if (currentUser.role === targetRole) {
            showToast('Você já possui este perfil.', 'error');
            setLoading(false);
            return;
        }

        const { success, error } = await upgradeRole(targetRole);

        if (success) {
            showToast(`Perfil atualizado para ${targetRole} com sucesso!`, 'success');
            onClose();
        } else {
            showToast(`Erro ao atualizar perfil: ${error}`, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark w-full max-w-md rounded-xl shadow-2xl border border-brand-accent/30 overflow-hidden transform animate-scale-up">
                <div className="bg-brand-darkest/80 px-6 py-4 border-b border-brand-accent/20 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-brand-accent">⚡</span> Upgrade de Perfil
                    </h2>
                    <button onClick={onClose} className="text-brand-med-gray hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleUpgrade} className="p-6 space-y-4">
                    <p className="text-sm text-brand-med-gray italic">
                        Perfil atual: <span className="text-brand-accent font-bold uppercase">{currentUser.role}</span>
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Selecione o novo perfil</label>
                        <select
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value as User['role'])}
                            className="w-full bg-brand-darkest/50 border border-brand-darkest rounded-md py-2 px-3 text-white focus:ring-brand-accent focus:border-brand-accent outline-none"
                        >
                            <option value="Executor">Executor</option>
                            <option value="Gerenciador">Gerenciador</option>
                            <option value="Planejador">Planejador</option>
                            <option value="Master">Master</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Token de Acesso</label>
                        <input
                            type="password"
                            placeholder="Digite o token do perfil"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            required
                            className="w-full bg-brand-darkest/50 border border-brand-darkest rounded-md py-2 px-3 text-white placeholder-brand-med-gray focus:ring-brand-accent focus:border-brand-accent outline-none"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-brand-darkest text-brand-med-gray rounded-md hover:bg-brand-darkest transition-colors font-medium shadow-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-brand-accent text-white rounded-md hover:bg-orange-600 transition-all font-bold shadow-lg shadow-brand-accent/20 disabled:opacity-50"
                        >
                            {loading ? 'Processando...' : 'Confirmar Upgrade'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UpgradeModal;
