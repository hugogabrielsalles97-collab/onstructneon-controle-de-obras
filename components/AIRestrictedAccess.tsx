import React from 'react';

interface AIRestrictedAccessProps {
    featureName: string;
    onUpgradeClick: () => void;
    description?: string;
}

const AIRestrictedAccess: React.FC<AIRestrictedAccessProps> = ({
    featureName,
    onUpgradeClick,
    description
}) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in relative z-10 min-h-[400px]">
            <div className="w-24 h-24 bg-brand-accent/10 rounded-2xl flex items-center justify-center mb-6 border border-brand-accent/20 shadow-2xl relative group">
                <div className="absolute inset-0 bg-brand-accent rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <svg className="w-12 h-12 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic mb-4">Acesso <span className="text-brand-accent">Restrito</span></h2>
            <p className="text-brand-med-gray text-sm max-w-md mx-auto mb-8 leading-relaxed font-light">
                O <strong className="text-white font-bold italic">{featureName}</strong> utiliza inteligência artificial avançada para otimizar sua gestão.
                <br /><br />
                {description || "Esta funcionalidade é exclusiva para os perfis Gerenciador e Master."}
            </p>
            <button
                onClick={onUpgradeClick}
                className="px-8 py-4 bg-gradient-to-r from-brand-accent to-orange-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-brand-accent/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2"
            >
                <span className="text-base">⚡</span> Finalizar Upgrade de Perfil
            </button>

            {/* Background Elements for Bloqueio */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-brand-accent/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>
        </div>
    );
};

export default AIRestrictedAccess;
