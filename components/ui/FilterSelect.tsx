import React from 'react';

interface FilterSelectProps {
    name: string;
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
}

const FilterSelect: React.FC<FilterSelectProps> = ({ name, label, value, onChange, options }) => (
    <div className="flex flex-col group">
        <label htmlFor={name} className="text-[9px] text-brand-med-gray font-black uppercase mb-1.5 ml-1 tracking-wider transition-colors group-focus-within:text-brand-accent">{label}</label>
        <select
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            className="bg-brand-darkest/40 border border-white/5 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-accent text-xs w-full shadow-inner transition-all hover:bg-brand-darkest/60 appearance-none cursor-pointer"
        >
            <option value="">Ver Todos</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

export default FilterSelect;
