import React, { useState, useEffect, Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface HeroProps {
  onNavigateToLogin: () => void;
  onScrollToServices: () => void;
}

const Hero: React.FC<HeroProps> = ({ onNavigateToLogin, onScrollToServices }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [splineLoaded, setSplineLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section id="hero" className="relative min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#050505' }}>
      {/* ===== FUNDO 3D SPLINE — Robô ===== */}
      <div className="absolute inset-0 z-0">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin"></div>
                <span className="text-xs text-gray-600 font-mono tracking-wider uppercase">Carregando 3D...</span>
              </div>
            </div>
          }
        >
          <Spline
            scene="https://prod.spline.design/hexuqa5qZiK54viX/scene.splinecode"
            onLoad={() => setSplineLoaded(true)}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        </Suspense>
      </div>
      {/* ===== FIM DO FUNDO 3D ===== */}

      {/* Overlay sutil para garantir legibilidade do texto sobre o 3D */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-[#050505]/70 via-transparent to-[#050505]/80"></div>
      {/* Overlay lateral esquerdo para o texto */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-r from-[#050505]/60 via-transparent to-transparent"></div>

      {/* Navbar */}
      <nav className="relative z-20 w-full px-6 sm:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo ELOS */}
          <div className="relative">
            <div className="absolute inset-0 bg-brand-accent/20 blur-lg rounded-full"></div>
            <div className="relative bg-[#111827]/60 p-2.5 rounded-xl border border-brand-accent/20 backdrop-blur-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e35a10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M10 12h4" />
                <path d="M12 10v4" />
                <path d="M6 2v4" />
                <path d="M18 2v4" />
              </svg>
            </div>
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tighter uppercase italic">ELOS</span>
            <span className="hidden sm:block text-[8px] text-brand-med-gray font-bold uppercase tracking-[0.25em] -mt-0.5 opacity-60">EGTC Lean Operational Solution</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onScrollToServices}
            className="hidden sm:flex items-center gap-1.5 text-sm text-gray-400 hover:text-white font-medium transition-colors duration-300 px-4 py-2"
          >
            Soluções
          </button>
          <button
            onClick={onNavigateToLogin}
            className="group relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-orange-600 rounded-xl hover:to-orange-500 transition-all duration-300 shadow-[0_0_20px_-5px_rgba(227,90,16,0.4)] hover:shadow-[0_0_30px_-5px_rgba(227,90,16,0.6)] hover:-translate-y-0.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Acessar
          </button>
        </div>
      </nav>

      {/* Conteúdo principal do Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
        <div
          className="max-w-4xl mx-auto"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
            transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Título ELOS */}
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-none mb-4 drop-shadow-[0_2px_30px_rgba(0,0,0,0.8)]">
            ELOS
          </h1>
          <p className="text-sm sm:text-base md:text-lg font-bold uppercase tracking-[0.3em] text-brand-accent/90 mb-6 drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]">
            EGTC Lean Operational Solution
          </p>

          {/* Subtítulo */}
          <p
            className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
            }}
          >
            Planejamento, monitoramento e gestão lean integrados em uma única plataforma.
            <span className="text-white font-medium"> Do cronograma ao campo, em tempo real.</span>
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pointer-events-auto"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s',
            }}
          >
            <button
              onClick={onNavigateToLogin}
              className="group relative flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-accent to-orange-600 rounded-2xl text-white font-bold text-base hover:to-orange-500 transition-all duration-300 shadow-[0_0_40px_-10px_rgba(227,90,16,0.5)] hover:shadow-[0_0_60px_-10px_rgba(227,90,16,0.7)] hover:-translate-y-1"
            >
              Começar Agora
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>

            <button
              onClick={onScrollToServices}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-white/10 text-gray-300 font-semibold text-base hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
            >
              Conhecer Soluções
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>


      </div>

      {/* Faixa inferior fina para cobrir watermark "Built with Spline" */}
      <div className="absolute bottom-0 left-0 w-full h-16 bg-[#050505] z-[3] pointer-events-none"></div>
      {/* Gradiente de transição suave para Services */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#050505] to-transparent z-[2] pointer-events-none"></div>
    </section>
  );
};

export default Hero;
