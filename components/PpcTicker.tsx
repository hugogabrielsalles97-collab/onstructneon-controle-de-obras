import React from 'react';

export interface PpcTickerItem {
    engineer: string;
    lastWeekPpc: number;   // PPC da última semana fechada (%)
    avg: number;           // média geral do próprio engenheiro (%)
    delta: number;         // lastWeekPpc - avg (pontos percentuais)
}

/**
 * Faixa rolante estilo bolsa de valores: passa o PPC da semana anterior por
 * engenheiro, com indicador de alta/baixa em relação à média do próprio engenheiro.
 */
const PpcTicker: React.FC<{ items: PpcTickerItem[] }> = ({ items }) => {
    if (!items || items.length === 0) return null;

    const loop = [...items, ...items]; // duplica para rolagem contínua
    const duration = Math.max(24, items.length * 6); // segundos

    return (
        <div className="ppc-ticker-wrap relative overflow-hidden bg-[#0a0f18] border border-white/10 rounded-xl shadow-inner non-printable">
            <style>{`
                @keyframes ppc-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                .ppc-ticker-track { animation: ppc-ticker-scroll ${duration}s linear infinite; }
                .ppc-ticker-wrap:hover .ppc-ticker-track { animation-play-state: paused; }
            `}</style>

            <div className="flex items-center">
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-brand-accent shrink-0 px-3 py-2.5 border-r border-white/10 bg-[#0a0f18] z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                    PPC Semana Anterior · por Engenheiro
                </span>

                <div className="relative flex-1 overflow-hidden">
                    <div className="ppc-ticker-track flex whitespace-nowrap will-change-transform py-2.5">
                        {loop.map((it, i) => {
                            const up = it.delta > 0;
                            const down = it.delta < 0;
                            const color = up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-gray-400';
                            const arrow = up ? '▲' : down ? '▼' : '—';
                            return (
                                <span key={i} className="flex items-center gap-2 text-xs font-bold mr-8">
                                    <span className="text-gray-200 uppercase tracking-tight">{it.engineer}</span>
                                    <span className="font-black text-white font-mono">{it.lastWeekPpc}%</span>
                                    <span className={`flex items-center gap-0.5 font-black font-mono ${color}`}>
                                        {arrow} {it.delta > 0 ? '+' : ''}{it.delta}
                                    </span>
                                    <span className="text-[9px] text-brand-med-gray font-mono">méd {it.avg}%</span>
                                    <span className="text-white/15 pl-2">|</span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PpcTicker;
