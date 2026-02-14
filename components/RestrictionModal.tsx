import React, { useState, useEffect } from 'react';
import { Restriction, RestrictionType, RestrictionStatus, RestrictionPriority } from '../types';
import ClearIcon from './icons/ClearIcon';

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

            // Formatar para YYYY-MM-DD (compatível com input date)
            const yyyy = suggested.getFullYear();
            const mm = String(suggested.getMonth() + 1).padStart(2, '0');
            const dd = String(suggested.getDate()).padStart(2, '0');

            setFormData(prev => ({ ...prev, due_date: `${yyyy}-${mm}-${dd}` }));
        }
    }, [baselineTaskStartDate, restriction]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.description.trim() || !formData.responsible.trim()) {
            alert('Preencha todos os campos obrigatórios');
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
                console.error('Erro ao salvar restrição:', result.error);
                alert(`Erro ao salvar restrição: ${result.error}`);
            }
        } catch (error) {
            console.error('Erro ao salvar restrição:', error);
            alert('Erro ao salvar restrição');
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111827] rounded-2xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-[#111827] border-b border-white/10 p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white">
                            {restriction ? 'Editar Restrição' : 'Adicionar Restrição'}
                        </h2>
                        <p className="text-sm text-brand-med-gray mt-1">
                            Atividade: <span className="text-brand-accent font-bold">{baselineTaskTitle}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        <ClearIcon className="w-6 h-6 text-brand-med-gray hover:text-white" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Tipo de Restrição */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Tipo de Restrição *
                        </label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            className="w-full bg-brand-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-accent focus:outline-none transition-colors border-2 border-transparent focus:border-brand-accent"
                            required
                        >
                            {Object.values(RestrictionType).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Prioridade */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Prioridade *
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.values(RestrictionPriority).map(priority => (
                                <button
                                    key={priority}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, priority }))}
                                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${formData.priority === priority
                                        ? priority === RestrictionPriority.Critical
                                            ? 'bg-red-500 text-white border-2 border-red-400'
                                            : priority === RestrictionPriority.High
                                                ? 'bg-orange-500 text-white border-2 border-orange-400'
                                                : priority === RestrictionPriority.Medium
                                                    ? 'bg-yellow-500 text-white border-2 border-yellow-400'
                                                    : 'bg-green-500 text-white border-2 border-green-400'
                                        : 'bg-white/5 text-brand-med-gray border-2 border-transparent hover:bg-white/10'
                                        }`}
                                >
                                    {priority}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Descrição da Restrição *
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            placeholder="Descreva detalhadamente a restrição que impede o início ou continuidade desta atividade..."
                            className="w-full bg-brand-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-brand-med-gray focus:border-brand-accent focus:outline-none transition-colors resize-none border-2 border-transparent focus:border-brand-accent"
                            required
                        />
                    </div>

                    {/* Responsável e Setor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-white mb-2">
                                Responsável pela Remoção *
                            </label>
                            <input
                                type="text"
                                name="responsible"
                                value={formData.responsible}
                                onChange={handleChange}
                                placeholder="Nome do indivíduo"
                                className="w-full bg-brand-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-brand-med-gray focus:border-brand-accent focus:outline-none transition-colors border-2 border-transparent focus:border-brand-accent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-white mb-2">
                                Setor Responsável
                            </label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="w-full bg-brand-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-accent focus:outline-none transition-colors border-2 border-transparent focus:border-brand-accent"
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
                    </div>

                    {/* Status e Data Limite */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-bold text-white">
                                    Data Limite (Conclusão)
                                </label>
                                {baselineTaskStartDate && (
                                    <span className="text-[10px] text-brand-accent font-black uppercase bg-brand-accent/10 px-2 py-0.5 rounded">
                                        Sugestão do Sistema
                                    </span>
                                )}
                            </div>
                            <input
                                type="date"
                                name="due_date"
                                value={formData.due_date}
                                onChange={handleChange}
                                className="w-full bg-brand-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-accent focus:outline-none transition-colors border-2 border-transparent focus:border-brand-accent"
                            />
                            {baselineTaskStartDate && (
                                <p className="text-[10px] text-brand-med-gray mt-1.5 ml-1">
                                    Data sugerida: <span className="text-white font-bold">{getFormattedSuggestedDate()}</span> (2 dias antes do início)
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-white mb-2">
                                Status Inicial
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full bg-brand-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-accent focus:outline-none transition-colors border-2 border-transparent focus:border-brand-accent"
                            >
                                {Object.values(RestrictionStatus).map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all font-bold border border-white/10 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-brand-accent text-white rounded-xl hover:bg-[#e35a10] transition-all font-bold shadow-lg shadow-brand-accent/20 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Salvando...' : restriction ? 'Salvar Alterações' : 'Adicionar Restrição'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RestrictionModal;
