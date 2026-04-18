import React from 'react';

interface FilterInputProps {
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
}

const FilterInput: React.FC<FilterInputProps> = ({ name, label, value, onChange, type = "text", placeholder }) => (
    <div className="flex flex-col group">
        <label htmlFor={name} className="text-[9px] text-brand-med-gray font-black uppercase mb-1.5 ml-1 tracking-wider transition-colors group-focus-within:text-brand-accent">{label}</label>
        <input
            type={type}
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="bg-brand-darkest/40 border border-white/5 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-accent text-xs w-full shadow-inner transition-all hover:bg-brand-darkest/60"
        />
    </div>
);

export default FilterInput;
