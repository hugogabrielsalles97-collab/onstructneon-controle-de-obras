import React, { useEffect, useRef, useState } from 'react';

interface ServicesProps {
  onNavigateToLogin: () => void;
}

const services = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
        <path d="M8 18h.01" /><path d="M12 18h.01" />
      </svg>
    ),
    title: 'Cronograma Inteligente',
    description: 'Planeje e acompanhe atividades com baseline, cronograma atual e controle de desvios em tempo real.',
    gradient: 'from-brand-accent/20 to-orange-600/10',
    borderColor: 'hover:border-brand-accent/30',
    glowColor: 'rgba(227, 90, 16, 0.15)',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: 'Lean Construction',
    description: 'Programação semanal com sistema PPC, encurtada via WhatsApp, análise de restrições e gestão de causa de não cumprimento.',
    gradient: 'from-blue-500/20 to-cyan-600/10',
    borderColor: 'hover:border-blue-500/30',
    glowColor: 'rgba(59, 130, 246, 0.15)',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <path d="M3 20h18" />
      </svg>
    ),
    title: 'Monitoramento de Campo',
    description: 'Acompanhe execução de serviços programados com registros fotográficos e avanço de campo.',
    gradient: 'from-emerald-500/20 to-green-600/10',
    borderColor: 'hover:border-emerald-500/30',
    glowColor: 'rgba(16, 185, 129, 0.15)',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Gestão em Tempo Real',
    description: 'Visão executiva integrada, Takt, produtividade real e potencial.',
    gradient: 'from-purple-500/20 to-violet-600/10',
    borderColor: 'hover:border-purple-500/30',
    glowColor: 'rgba(139, 92, 246, 0.15)',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Relatórios e Análises',
    description: 'Relatórios gerenciais automatizados, curva S, histogramas de equipes.',
    gradient: 'from-amber-500/20 to-yellow-600/10',
    borderColor: 'hover:border-amber-500/30',
    glowColor: 'rgba(245, 158, 11, 0.15)',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: 'IA Assistente',
    description: 'Inteligência artificial integrada que analisa dados, sugere ações e gera insights sobre sua obra.',
    gradient: 'from-rose-500/20 to-pink-600/10',
    borderColor: 'hover:border-rose-500/30',
    glowColor: 'rgba(244, 63, 94, 0.15)',
  },
];

const Services: React.FC<ServicesProps> = ({ onNavigateToLogin }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setVisibleCards((prev) => new Set(prev).add(index));
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    const cards = sectionRef.current?.querySelectorAll('[data-index]');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-6 sm:px-10"
      style={{ backgroundColor: '#050505' }}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-brand-accent/20 to-transparent"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header da seção */}
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/[0.02] mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent"></div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Módulos Integrados</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-5 pb-2 overflow-visible">
            Tudo que sua obra{' '}
            <span style={{ background: 'linear-gradient(to right, #e35a10, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontStyle: 'italic', lineHeight: '1.3', paddingBottom: '4px', display: 'inline-block' }}>precisa</span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Uma plataforma completa que integra planejamento, execução e controle em um só lugar.
          </p>
        </div>

        {/* Grid de serviços */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              data-index={index}
              className={`group relative bg-[#111827]/30 backdrop-blur-sm border border-white/[0.04] rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1 ${service.borderColor}`}
              style={{
                opacity: visibleCards.has(index) ? 1 : 0,
                transform: visibleCards.has(index) ? 'translateY(0)' : 'translateY(30px)',
                transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`,
              }}
            >
              {/* Glow effect on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ boxShadow: `inset 0 0 60px -20px ${service.glowColor}` }}
              ></div>

              {/* Icon */}
              <div className={`relative inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${service.gradient} border border-white/5 mb-5 text-white group-hover:scale-110 transition-transform duration-500`}>
                {service.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-white mb-2.5 tracking-tight group-hover:text-brand-accent transition-colors duration-300">
                {service.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">{service.description}</p>

              {/* Bottom accent line */}
              <div className="mt-5 w-0 group-hover:w-full h-[1px] bg-gradient-to-r from-brand-accent/50 to-transparent transition-all duration-700"></div>
            </div>
          ))}
        </div>

        {/* CTA inferior */}
        <div className="mt-16 sm:mt-20 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 sm:p-8 rounded-2xl border border-white/[0.04] bg-[#111827]/20 backdrop-blur-sm">
            <div className="text-left">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Pronto para transformar sua gestão?</h3>
              <p className="text-sm text-gray-400">Acesse a plataforma e comece a controlar sua obra de verdade.</p>
            </div>
            <button
              onClick={onNavigateToLogin}
              className="shrink-0 flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-brand-accent to-orange-600 rounded-xl text-white font-bold text-sm hover:to-orange-500 transition-all duration-300 shadow-[0_0_25px_-5px_rgba(227,90,16,0.4)] hover:shadow-[0_0_40px_-5px_rgba(227,90,16,0.6)] hover:-translate-y-0.5"
            >
              Acessar Plataforma
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer minimalista */}
      <div className="relative z-10 mt-24 pt-8 border-t border-white/[0.04] max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white tracking-tighter uppercase italic">ELOS</span>
          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">EGTC Lean Operational Solution</span>
        </div>
        <p className="text-[11px] text-gray-600 font-mono">
          &copy; {new Date().getFullYear()} ELOS. Engenharia de Alta Performance.
        </p>
      </div>
    </section>
  );
};

export default Services;
