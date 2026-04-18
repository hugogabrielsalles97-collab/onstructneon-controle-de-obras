import React, { useState } from 'react';
import XIcon from './icons/XIcon';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'danger',
    isLoading = false,
}) => {
    if (!isOpen) return null;

    const isDanger = type === 'danger';

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-[#0a0f18]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] w-full max-w-sm shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] transform transition-all animate-scale-up border-t-white/10"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Visual */}
                <div className={`h-2 w-full rounded-t-[2rem] ${isDanger ? 'bg-red-500' : 'bg-brand-accent'}`} />

                <div className="p-8 flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-full ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-brand-accent/10 text-brand-accent'} flex items-center justify-center mb-6 border ${isDanger ? 'border-red-500/20' : 'border-brand-accent/20'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <h3 className="text-xl font-black text-white uppercase tracking-wide mb-2">
                        {title}
                    </h3>

                    <p className="text-gray-400 text-sm leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs text-white shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:transform-none
                ${isDanger
                                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                                    : 'bg-brand-accent hover:bg-orange-600 shadow-brand-accent/20'
                                }`}
                        >
                            {isLoading ? 'Processando...' : confirmText}
                        </button>

                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
