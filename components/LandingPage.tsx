import React, { useRef } from 'react';
import Hero from './landing/Hero';
import Services from './landing/Services';

interface LandingPageProps {
  onNavigateToLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin }) => {
  const servicesRef = useRef<HTMLDivElement>(null);

  const handleScrollToServices = () => {
    servicesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <Hero
        onNavigateToLogin={onNavigateToLogin}
        onScrollToServices={handleScrollToServices}
      />
      <div ref={servicesRef}>
        <Services onNavigateToLogin={onNavigateToLogin} />
      </div>
    </div>
  );
};

export default LandingPage;
