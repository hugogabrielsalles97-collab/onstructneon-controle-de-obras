
import React from 'react';

const ConstructionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M10 12h4" />
    <path d="M12 10v4" />
    <path d="M2 10h.01" />
    <path d="M22 10h-.01" />
    <path d="M6 2v4" />
    <path d="M18 2v4" />
    <path d="M2 14h.01" />
    <path d="M22 14h-.01" />
  </svg>
);

export default ConstructionIcon;
