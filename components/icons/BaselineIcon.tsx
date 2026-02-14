import React from 'react';

const BaselineIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M4 20h16" />
    <path d="M4 16h16" />
    <path d="M4 12h16" />
    <path d="M4 8h16" />
    <path d="M14 4h-4" />
    <path d="M12 4v16" />
  </svg>
);

export default BaselineIcon;