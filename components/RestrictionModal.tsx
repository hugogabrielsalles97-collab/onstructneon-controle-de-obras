import React, { useState, useEffect } from 'react';
import { Restriction, RestrictionType, RestrictionStatus, RestrictionPriority } from '../types';
import XIcon from './icons/XIcon';
import AlertIcon from './icons/AlertIcon';

interface RestrictionModalProps {
    baselineTaskId: string;
    baselineTaskTitle: string;
    baselineTaskStartDate: string;
    restriction?: Restriction;
    onClose: () => void;
    onSave: (restriction: Omit<Restriction, 'id' | 'created_at' | 'user_id'>) => Promise<{ success: boolean; error?: string }>;
    onUpdate?: (id: string, updates: Partial<Restriction>) => Promise<{ success: boolean; error?: string }>;
}

const RestrictionModal: React.FC<RestrictionModalProps> = ({
    baselineTaskId,
    baselineTaskTitle,
    baselineTaskStartDate,
    restriction,
    onClose,
    onSave,
    onUpdate
}) => {
    const [formData, setFormData] = useState({
        type: restriction?.type || RestrictionType.Material,
        description: restriction?.description || '',
        priority: restriction?.priority || RestrictionPriority.Medium,
        responsible: restriction?.responsible || '',
        department: restriction?.department || '',
        status: restriction?.status || RestrictionStatus.Pending,
        due_date: restriction?.due_date || ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sugerir data limite (2 dias antes do início) apenas se for nova restrição
    useEffect(() => {
        if (baselineTaskStartDate && !restriction) {
            const startDate = new Date(baselineTaskStartDate);
            const suggested = new Date(startDate);
            suggested.setDate(startDate.getDate() - 2);

            const yyyy = suggested.getFullYear();
            const mm = String(suggested.getMonth() + 1).padStart(2, '0');
            const dd = String(suggested.getDate()).padStart(2, '0');

            setFormData(prev => ({ ...prev, due_date: `${yyyy}-${mm}-${dd}` }));
        }
    }, [baselineTaskStartDate, restriction]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description.trim() || !formData.responsible.trim()) {
            alert('Preencha os campos obrigatórios (Descrição e Responsável)');
            return;
        }

        setIsSubmitting(true);
        try {
            const data = {
                baseline_task_id: baselineTaskId,
                type: formData.type,
                description: formData.description.trim(),
                status: formData.status,
                priority: formData.priority,
                responsible: formData.responsible.trim(),
                department: formData.department.trim() || undefined,
                due_date: formData.due_date || undefined
            };

            let result;
            if (restriction && onUpdate) {
                result = await onUpdate(restriction.id, data);
            } else {
                result = await onSave(data);
            }

            if (result.success) {
                onClose();
            } else {
                alert(`Erro: ${result.error}`);
            }
        } catch (error) {
            alert('Erro ao processar solicitação');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const getFormattedSuggestedDate = () => {
        if (!baselineTaskStartDate) return '';
        const startDate = new Date(baselineTaskStartDate);
        const suggested = new Date(startDate);
        suggested.setDate(startDate.getDate() - 2);
        return suggested.toLocaleDateString('pt-BR');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
            {/* Backdrop com desfoque profundo */}
            <div
                className="absolute inset-0 bg-[#060a12]/80 backdrop-blur-2xl animate-fade-in"
                onClick={onClose}
            ></div>

            {/* Modal Container Glassmorphism */}
            <div className="relative w-full max-w-2xl bg-[#0a0f18]/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(227,90,16,0.15)] overflow-hidden flex flex-col animate-slide-up max-h-[90vh]">

                {/* Brand Accent Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-brand-accent to-transparent opacity-50"></div>

                {/* Header */}
                <div className="px-8 py-6 flex justify-between items-start border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-accent/20 flex items-center justify-center border border-brand-accent/30 shadow-lg shadow-brand-accent/10">
                                <AlertIcon className="w-6 h-6 text-brand-accent" />
                            </div>
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">
                                {restriction ? 'Editar' : 'Nova'} <span className="text-brand-accent">Restrição</span>
                            </h2>
                        </div>
                        <p className="text-[10px] text-brand-med-gray font-black uppercase tracking-[0.2em] mt-1 pl-13 flex items-center gap-2">
                            Atividade: <span className="text-white bg-white/5 px-2 py-0.5 rounded italic">{baselineTaskTitle}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-500 text-brand-med-gray transition-all group"
                    >
                        <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                    {/* Seção 1: Classificação */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-4 bg-brand-accent rounded-full"></div>
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Classificação e Prioridade</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-white/5 rounded-3xl border border-white/5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Tipo de Impedimento</label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold appearance-none"
                                >
                                    {Object.values(RestrictionType).map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Impacto (Prioridade)</label>
                                <div className="flex gap-2">
                                    {[RestrictionPriority.Low, RestrictionPriority.Medium, RestrictionPriority.High, RestrictionPriority.Critical].map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, priority: p }))}
                                            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${formData.priority === p
                                                ? (p === RestrictionPriority.Critical ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105' :
                                                    p === RestrictionPriority.High ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-105' :
                                                        p === RestrictionPriority.Medium ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30 scale-105' :
                                                            'bg-green-500 text-white shadow-lg shadow-green-500/30 scale-105')
                                                : 'bg-white/5 text-brand-med-gray border border-white/5 hover:bg-white/10'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Seção 2: Detalhes */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-4 bg-brand-accent rounded-full"></div>
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Descrição detalhada</h3>
                        </div>
                        <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="O que está impedindo a atividade? Ex: Aguardando entrega de vergalhões CA-50..."
                                className="w-full h-28 bg-[#111827]/40 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold resize-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Seção 3: Responsabilidade */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-4 bg-brand-accent rounded-full"></div>
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Responsabilidade e Prazos</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-white/5 rounded-3xl border border-white/5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Responsável pela Remoção</label>
                                <input
                                    type="text"
                                    name="responsible"
                                    value={formData.responsible}
                                    onChange={handleChange}
                                    placeholder="Nome do responsável..."
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Setor / Departamento</label>
                                <select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold appearance-none"
                                >
                                    <option value="">Selecione o setor...</option>
                                    <option value="Engenharia">Engenharia</option>
                                    <option value="Suprimentos">Suprimentos</option>
                                    <option value="Financeiro">Financeiro</option>
                                    <option value="RH">RH</option>
                                    <option value="Logística">Logística</option>
                                    <option value="Qualidade">Qualidade</option>
                                    <option value="Manutenção">Manutenção</option>
                                    <option value="Segurança">Segurança (SESMT)</option>
                                    <option value="Produção">Produção</option>
                                    <option value="Cliente">Cliente / Fiscalização</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">Data de Resolução (Limite)</label>
                                </div>
                                <input
                                    type="date"
                                    name="due_date"
                                    value={formData.due_date}
                                    onChange={handleChange}
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold"
                                />
                                {baselineTaskStartDate && (
                                    <p className="text-[9px] text-brand-accent/70 font-bold uppercase tracking-widest mt-1 ml-1 animate-pulse">
                                        Data Sugerida: {getFormattedSuggestedDate()}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] ml-1">Status da Restrição</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full bg-[#111827]/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-brand-accent/50 focus:outline-none transition-all font-bold appearance-none"
                                >
                                    {Object.values(RestrictionStatus).map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="p-6 bg-black/20 border-t border-white/5 flex gap-4 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-[2] py-4 bg-brand-accent text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-accent/20 hover:bg-[#e35a10] transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Processando...' : restriction ? 'Gravar Alterações' : 'Confirmar Restrição'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RestrictionModal;
