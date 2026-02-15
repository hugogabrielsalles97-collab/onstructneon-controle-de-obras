import React, { useState } from 'react';
import { User } from '../types';
import { useData } from '../context/DataProvider';
import XIcon from './icons/XIcon';
import ConstructionIcon from './icons/ConstructionIcon';

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-[#0a0f18]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] w-full max-w-md shadow-[0_0_100px_-20px_rgba(227,90,16,0.3)] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-8 pb-4 flex justify-between items-center border-b border-white/5 bg-gradient-to-r from-brand-accent/5 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center shadow-lg shadow-brand-accent/20 rotate-3 transition-transform hover:rotate-0">
                            <span className="text-2xl text-white">⚡</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Upgrade <span className="text-brand-accent">Perfil</span></h2>
                            <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mt-0.5">Gestão de Acesso</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-med-gray hover:text-white transition-all border border-white/10"><XIcon className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <form onSubmit={handleUpgrade} className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 custom-scrollbar">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex-1">
                                <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[2px] mb-1">Perfil Atual</p>
                                <p className="text-lg font-black text-brand-accent uppercase italic">{currentUser.role}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center">
                                <ConstructionIcon className="w-5 h-5 text-brand-accent opacity-50" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Selecione o novo perfil</label>
                                <select
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 transition-all font-bold appearance-none cursor-pointer"
                                    value={targetRole}
                                    onChange={(e) => setTargetRole(e.target.value as User['role'])}
                                >
                                    <option value="Executor">Executor</option>
                                    <option value="Gerenciador">Gerenciador</option>
                                    <option value="Planejador">Planejador</option>
                                    <option value="Master">Master</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Token de Acesso</label>
                                <input
                                    type="password"
                                    placeholder="Digite o token do perfil"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    required
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 transition-all font-bold placeholder:text-gray-600"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 space-y-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-brand-accent hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-accent/20 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:transform-none"
                        >
                            {loading ? 'Processando...' : 'Confirmar Upgrade'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UpgradeModal;
