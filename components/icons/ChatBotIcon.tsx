import React from 'react';

const ChatBotIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M12 6V4H8" />
    <path d="M16 4h-4" />
    <path d="M18 10V8" />
    <path d="M18 18v-2" />
    <path d="M16 20h-4" />
    <path d="M12 14v6" />
    <path d="M8 18v2" />
    <path d="M6 12H4" />
    <path d="M12 12H6" />
    <path d="M12 6h6" />
    <path d="M6 10V8" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export default ChatBotIcon;