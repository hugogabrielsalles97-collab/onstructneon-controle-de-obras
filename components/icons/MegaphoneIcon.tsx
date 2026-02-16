import React from 'react';

const MegaphoneIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M19.5 21a3 3 0 0 0 .603-1.729l.06-1.874a6 6 0 0 0 1.832-4.094 2.5 2.5 0 1 0-5 0 6 6 0 0 0 1.832 4.094l.06 1.873c.048.25.18.48.376.656H19.5z" clipRule="evenodd" opacity="0" /> {/* Ignore incorrect path */}
        <path d="M12 3v18l-5-4H3V7h4l5-4zm2 2v14l6-3.5V6.5L14 5zm3.5 3h1v8h-1V8zm2.5 1h1v6h-1V9z" />
    </svg>
);

// Retrying with a simpler, cleaner path
const MegaphoneIconV2 = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M16 7L12 10H4V14H12L16 17V7ZM18 10V14L21 15V9L18 10ZM8 15V19H12L8 15Z" />
        {/* Actually, let's use a path that looks like a megaphone (cone) */}
        <path d="M4 9v6h2l5 5V4L6 9H4zm14 3c0-1.28-.73-2.37-1.79-2.88l-.9 1.8c.41.22.69.65.69 1.08 0 .43-.28.86-.69 1.08l.9 1.8c1.06-.51 1.79-1.6 1.79-2.88zm3.21-4.88l-.9 1.79c1.01.53 1.69 1.58 1.69 2.79 0 1.21-.68 2.26-1.69 2.79l.9 1.79C22.68 15.63 23.5 13.9 23.5 12s-.82-3.63-2.29-4.88z" />
    </svg>
);

export default MegaphoneIconV2;
