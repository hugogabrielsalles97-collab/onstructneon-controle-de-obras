
import React from 'react';

const SortIcon: React.FC<{ className?: string; direction?: 'asc' | 'desc' }> = ({ className, direction = 'asc' }) => (
  <div className={`flex flex-col ${className}`}>
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={`-mb-1 transition-colors ${direction === 'asc' ? 'text-brand-accent' : ''}`}
    >
        <path d="m18 15-6-6-6 6"/>
    </svg>
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={`-mt-1 transition-colors ${direction === 'desc' ? 'text-brand-accent' : ''}`}
    >
        <path d="m6 9 6 6 6-6"/>
    </svg>
  </div>
);

export default SortIcon;
