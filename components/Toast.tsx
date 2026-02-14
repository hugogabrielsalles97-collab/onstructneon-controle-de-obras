import React, { useEffect } from 'react';
import InfoIcon from './icons/InfoIcon';
import XIcon from './icons/XIcon';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  const baseClasses = "fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-2xl z-50 animate-fade-in max-w-sm";
  const typeClasses = {
    success: "bg-green-600/90 border-green-500 text-white border shadow-green-500/20",
    error: "bg-red-600/90 border-red-500 text-white border shadow-red-500/20",
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      <div className="flex-shrink-0">
        <InfoIcon className="w-6 h-6" />
      </div>
      <div className="ml-3 text-sm font-medium">
        {message}
      </div>
      <button 
        onClick={onClose} 
        className="ml-4 -mr-2 p-1.5 rounded-full inline-flex items-center justify-center hover:bg-white/20 transition"
        aria-label="Close"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;