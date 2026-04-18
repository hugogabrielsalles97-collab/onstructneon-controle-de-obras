import React, { useState } from 'react';
import XIcon from './icons/XIcon';
import { supabase } from '../supabaseClient';

interface ChangePasswordModalProps {
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, showToast }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const passwordRequirements = [
        { label: 'Mínimo 6 caracteres', met: newPassword.length >= 6 },
        { label: 'Contém letra maiúscula', met: /[A-Z]/.test(newPassword) },
        { label: 'Contém número', met: /[0-9]/.test(newPassword) },
    ];

    const allRequirementsMet = passwordRequirements.every(r => r.met);
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
    const canSubmit = allRequirementsMet && passwordsMatch && !isLoading;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!canSubmit) return;

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            showToast('Senha alterada com sucesso!', 'success');
            onClose();
        } catch (error: any) {
            const msg = error.message?.includes('same_password')
                ? 'A nova senha deve ser diferente da senha atual.'
                : error.message || 'Erro ao alterar a senha.';
            showToast(msg, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-brand-darkest/80 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-[#0d1525] rounded-3xl border border-white/10 shadow-2xl shadow-brand-accent/5 animate-slide-up overflow-hidden">
                {/* Glow decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-brand-accent to-transparent rounded-full" />

                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-accent/10 border border-brand-accent/20 rounded-xl flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-accent">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight">Alterar Senha</h2>
                            <p className="text-[10px] text-brand-med-gray font-bold uppercase tracking-widest">Segurança da Conta</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-brand-med-gray hover:text-white hover:bg-white/10 transition-all border border-white/10"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* New Password */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">
                            Nova Senha
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Digite a nova senha"
                                className="w-full bg-[#111827]/60 border border-white/10 rounded-2xl py-3.5 px-4 pr-12 text-white font-bold focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all placeholder:text-white/20"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-med-gray hover:text-white transition-colors p-1"
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Password Requirements */}
                    {newPassword.length > 0 && (
                        <div className="space-y-1.5 px-1 animate-fade-in">
                            {passwordRequirements.map((req, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${req.met
                                        ? 'bg-green-500/20 border border-green-500/40'
                                        : 'bg-white/5 border border-white/10'
                                        }`}>
                                        {req.met && (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-400">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-[11px] font-bold transition-colors ${req.met ? 'text-green-400' : 'text-brand-med-gray'}`}>
                                        {req.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">
                            Confirmar Nova Senha
                        </label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repita a nova senha"
                            className={`w-full bg-[#111827]/60 border rounded-2xl py-3.5 px-4 text-white font-bold focus:ring-2 focus:outline-none transition-all placeholder:text-white/20 ${confirmPassword.length > 0
                                ? passwordsMatch
                                    ? 'border-green-500/40 focus:ring-green-500/30'
                                    : 'border-red-500/40 focus:ring-red-500/30'
                                : 'border-white/10 focus:ring-brand-accent/50'
                                }`}
                        />
                        {confirmPassword.length > 0 && !passwordsMatch && (
                            <p className="text-[10px] text-red-400 font-bold ml-1 animate-fade-in">
                                As senhas não coincidem
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 px-4 bg-white/5 text-brand-med-gray hover:text-white rounded-2xl font-bold text-sm border border-white/10 hover:bg-white/10 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider border transition-all duration-300 flex items-center justify-center gap-2 ${canSubmit
                                ? 'bg-brand-accent text-white border-brand-accent/50 hover:bg-[#e35a10] shadow-lg shadow-brand-accent/20'
                                : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Salvar Senha
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
