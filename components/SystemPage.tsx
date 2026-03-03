
import React, { useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import { User } from '../types';
import { useData } from '../context/DataProvider';
import PlusIcon from './icons/PlusIcon';
import ClearIcon from './icons/ClearIcon';
import { disciplineOptions, taskTitleOptions } from '../utils/constants';

interface SystemPageProps {
    user: User;
    activeScreen: string;
    onNavigateToHome: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean?: () => void;
    onNavigateToLeanConstruction?: () => void;
    onNavigateToWarRoom?: () => void;
    onNavigateToCost?: () => void;
    onNavigateToPodcast?: () => void;
    onNavigateToCheckoutSummary: () => void;
    onNavigateToOrgChart?: () => void;
    onNavigateToOrgSummary?: () => void;
    onNavigateToTeams?: () => void;
    onNavigateToVisualControl?: () => void;
    onNavigateToSystem?: () => void;
    onUpgradeClick: () => void;
    onAddTask: () => void;
    showToast: (message: string, type: 'success' | 'error') => void;
}

const SystemPage: React.FC<SystemPageProps> = ({
    user,
    activeScreen,
    onAddTask,
    showToast,
    ...sidebarProps
}) => {
    const { catalogs, saveCatalogItem, deleteCatalogItem } = useData();
    // Form state
    const [isAdding, setIsAdding] = useState(false);
    const [mode, setMode] = useState<'discipline' | 'level' | 'activity'>('discipline');
    const [discipline, setDiscipline] = useState('');
    const [level, setLevel] = useState('');
    const [activityTitle, setActivityTitle] = useState('');

    // Derived data: use the SAME base options as TaskModal (Nova Atividade)
    // Plus any custom entries from catalogs
    const disciplines = useMemo(() => {
        const base = Object.keys(disciplineOptions);
        const fromCatalog = catalogs.map(c => c.discipline).filter(Boolean);
        return Array.from(new Set([...base, ...fromCatalog])).sort();
    }, [catalogs]);

    const availableLevels = useMemo(() => {
        if (!discipline) return [];
        // Same logic as TaskModal: base levels from disciplineOptions + catalog
        const base = disciplineOptions[discipline] || [];
        const fromCatalog = catalogs
            .filter(c => c.discipline === discipline && c.level)
            .map(c => c.level as string);
        return Array.from(new Set([...base, ...fromCatalog])).sort();
    }, [catalogs, discipline]);

    const availableTitles = useMemo(() => {
        if (!discipline || !level) return [];
        // Same logic as TaskModal: base titles from taskTitleOptions + catalog
        const base = taskTitleOptions[discipline]?.[level] || [];
        const fromCatalog = catalogs
            .filter(c => c.discipline === discipline && c.level === level && c.activity_title)
            .map(c => c.activity_title as string);
        return Array.from(new Set([...base, ...fromCatalog])).sort();
    }, [catalogs, discipline, level]);

    const handleSave = async () => {
        const trimmedDiscipline = discipline.trim();
        const trimmedLevel = level.trim();
        const trimmedActivityTitle = activityTitle.trim();

        if (mode === 'discipline') {
            if (!trimmedDiscipline) {
                showToast('Informe o nome da nova disciplina.', 'error');
                return;
            }
        } else if (mode === 'level') {
            if (!trimmedDiscipline) {
                showToast('Selecione uma disciplina para o novo nível.', 'error');
                return;
            }
            if (!trimmedLevel) {
                showToast('Informe o nome do novo nível.', 'error');
                return;
            }
        } else if (mode === 'activity') {
            if (!trimmedDiscipline) {
                showToast('Selecione a disciplina.', 'error');
                return;
            }
            if (!trimmedLevel) {
                showToast('Selecione o nível.', 'error');
                return;
            }
            if (!trimmedActivityTitle) {
                showToast('Informe o título da nova atividade.', 'error');
                return;
            }
        }

        const res = await saveCatalogItem({
            discipline: trimmedDiscipline,
            level: mode === 'discipline' ? null : trimmedLevel || null,
            activity_title: (mode === 'discipline' || mode === 'level') ? null : trimmedActivityTitle || null
        });

        if (res.success) {
            showToast('Cadastro realizado com sucesso!', 'success');
            // Keep selections for convenience but reset the main target
            if (mode === 'activity') setActivityTitle('');
            else if (mode === 'level') setLevel('');
            else setDiscipline('');
        } else {
            showToast(`Erro ao salvar: ${res.error}`, 'error');
        }
    };

    return (
        <div className="flex h-screen bg-[#0a0f18] text-gray-100 overflow-hidden font-sans selection:bg-brand-accent/30">
            <Sidebar
                user={user}
                activeScreen="system"
                onAddTask={onAddTask}
                {...sidebarProps}
            />

            <main className="flex-1 overflow-y-auto custom-scrollbar relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-accent/5 rounded-full blur-[120px] -mr-48 -mt-48 animate-pulse"></div>

                <div className="p-8 lg:p-12 max-w-7xl mx-auto relative z-10">
                    <header className="mb-12 animate-slide-down flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center border border-brand-accent/30 shadow-lg shadow-brand-accent/10">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-accent">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H20a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                                        Gestão de <span className="text-brand-accent">Cadastros</span>
                                    </h1>
                                    <p className="text-brand-med-gray font-medium mt-1">Configure as opções de disciplinas, níveis e atividades do sistema</p>
                                </div>
                            </div>
                        </div>

                        {!isAdding && (
                            <button
                                onClick={() => setIsAdding(true)}
                                className="flex items-center gap-2 bg-brand-accent text-white px-6 py-3 rounded-xl hover:bg-brand-accent/80 smooth-transition font-bold shadow-lg shadow-brand-accent/20 border border-white/10"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Novo Cadastro
                            </button>
                        )}
                    </header>

                    {isAdding && (
                        <div className="bg-white/5 border border-brand-accent/30 rounded-3xl p-8 mb-12 animate-slide-up relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-brand-accent"></div>
                            <h2 className="text-2xl font-black text-white mb-8 tracking-tight flex items-center gap-3">
                                <PlusIcon className="w-6 h-6 text-brand-accent" />
                                Adicionar Opções à Base de Dados
                            </h2>

                            {/* Mode Selection */}
                            <div className="flex gap-4 mb-8 p-1 bg-brand-darkest/50 rounded-2xl w-fit border border-white/5 mx-auto">
                                <button
                                    onClick={() => { setMode('discipline'); setDiscipline(''); setLevel(''); setActivityTitle(''); }}
                                    className={`px-6 py-3 rounded-xl font-bold smooth-transition flex items-center gap-2 ${mode === 'discipline' ? 'bg-brand-accent text-white shadow-lg' : 'text-brand-med-gray hover:text-white'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${mode === 'discipline' ? 'bg-white' : 'bg-brand-med-gray'}`}></div>
                                    Nova Disciplina
                                </button>
                                <button
                                    onClick={() => { setMode('level'); setDiscipline(''); setLevel(''); setActivityTitle(''); }}
                                    className={`px-6 py-3 rounded-xl font-bold smooth-transition flex items-center gap-2 ${mode === 'level' ? 'bg-brand-accent text-white shadow-lg' : 'text-brand-med-gray hover:text-white'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${mode === 'level' ? 'bg-white' : 'bg-brand-med-gray'}`}></div>
                                    Novo Nível
                                </button>
                                <button
                                    onClick={() => { setMode('activity'); setDiscipline(''); setLevel(''); setActivityTitle(''); }}
                                    className={`px-6 py-3 rounded-xl font-bold smooth-transition flex items-center gap-2 ${mode === 'activity' ? 'bg-brand-accent text-white shadow-lg' : 'text-brand-med-gray hover:text-white'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${mode === 'activity' ? 'bg-white' : 'bg-brand-med-gray'}`}></div>
                                    Novo Título
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="space-y-4 relative">
                                    <div className="flex justify-between items-center ml-2">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">
                                            {mode === 'discipline' ? 'Nome da Disciplina' : '1. Selecionar Disciplina'}
                                        </label>
                                        <span className="text-[9px] text-brand-accent font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-brand-accent/10 border border-brand-accent/20">Obrigatório</span>
                                    </div>
                                    {mode === 'discipline' ? (
                                        <input
                                            type="text"
                                            value={discipline}
                                            onChange={(e) => setDiscipline(e.target.value)}
                                            placeholder="Digite a nova disciplina..."
                                            className="w-full bg-brand-darkest/50 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5 smooth-transition shadow-inner"
                                        />
                                    ) : (
                                        <select
                                            value={discipline}
                                            onChange={(e) => {
                                                setDiscipline(e.target.value);
                                                setLevel('');
                                                setActivityTitle('');
                                            }}
                                            className="w-full bg-brand-darkest/50 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5 smooth-transition shadow-inner appearance-none cursor-pointer"
                                        >
                                            <option value="">Selecione a disciplina pai...</option>
                                            {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div className={`space-y-4 relative smooth-transition ${mode === 'discipline' ? 'opacity-20 pointer-events-none' : (mode !== 'discipline' && !discipline ? 'opacity-50' : 'opacity-100')}`}>
                                    <div className="flex justify-between items-center ml-2">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">
                                            {mode === 'level' ? 'Nome do Nível' : '2. Selecionar Nível'}
                                        </label>
                                        {mode !== 'discipline' && <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-400/10 border border-blue-400/20">{mode === 'level' ? 'Novo' : 'Filtro'}</span>}
                                    </div>
                                    {mode === 'activity' ? (
                                        <select
                                            value={level}
                                            onChange={(e) => {
                                                setLevel(e.target.value);
                                                setActivityTitle('');
                                            }}
                                            disabled={!discipline}
                                            className="w-full bg-brand-darkest/50 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5 smooth-transition shadow-inner appearance-none cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            <option value="">{discipline ? "Selecione o nível..." : "Preencha a disciplina primeiro"}</option>
                                            {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={level}
                                            onChange={(e) => {
                                                setLevel(e.target.value);
                                                if (mode === 'activity') setActivityTitle('');
                                            }}
                                            disabled={mode === 'discipline' || !discipline}
                                            placeholder={mode === 'discipline' ? "Não aplicável" : (discipline ? "Digite o novo nível..." : "Preencha a disciplina primeiro")}
                                            className="w-full bg-brand-darkest/50 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5 smooth-transition shadow-inner disabled:cursor-not-allowed"
                                        />
                                    )}
                                </div>

                                <div className={`space-y-4 relative smooth-transition ${mode !== 'activity' ? 'opacity-20 pointer-events-none' : (!level ? 'opacity-50' : 'opacity-100')}`}>
                                    <div className="flex justify-between items-center ml-2">
                                        <label className="text-[10px] font-black text-brand-med-gray uppercase tracking-[2px]">3. Título da Atividade</label>
                                        {mode === 'activity' && <span className="text-[9px] text-green-400 font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-green-400/10 border border-green-400/20">Novo</span>}
                                    </div>
                                    <input
                                        type="text"
                                        value={activityTitle}
                                        onChange={(e) => setActivityTitle(e.target.value)}
                                        disabled={mode !== 'activity' || !level}
                                        placeholder={mode !== 'activity' ? "Não aplicável" : (level ? "Digite a nova atividade..." : "Preencha o nível primeiro")}
                                        className="w-full bg-brand-darkest/50 border border-white/10 rounded-2xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-accent/50 focus:ring-4 focus:ring-brand-accent/5 smooth-transition shadow-inner disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-4">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="px-6 py-3 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 smooth-transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="bg-brand-accent text-white px-8 py-3 rounded-xl hover:bg-brand-accent/80 smooth-transition font-bold shadow-lg shadow-brand-accent/20"
                                >
                                    Salvar Cadastro
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden">
                            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-brand-accent rounded-full"></div>
                                    Base de Atividades Cadastradas
                                </h3>
                                <div className="text-[10px] font-black text-brand-med-gray uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
                                    {catalogs.length} Itens na Base
                                </div>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.01]">
                                            <th className="px-8 py-5 text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] border-b border-white/5">Disciplina</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] border-b border-white/5">Nível / Frente</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] border-b border-white/5">Título da Atividade</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-brand-med-gray uppercase tracking-[2px] border-b border-white/5 text-right whitespace-nowrap">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {catalogs.length > 0 ? catalogs.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/[0.02] smooth-transition group">
                                                <td className="px-8 py-5 text-sm font-bold text-gray-200">{item.discipline}</td>
                                                <td className="px-8 py-5 text-sm text-brand-med-gray">{item.level || <span className="opacity-20">-</span>}</td>
                                                <td className="px-8 py-5 text-sm font-medium text-white">{item.activity_title || <span className="opacity-20">-</span>}</td>
                                                <td className="px-8 py-5 text-right">
                                                    <button
                                                        onClick={() => deleteCatalogItem(item.id)}
                                                        className="text-red-500/50 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-lg smooth-transition"
                                                        title="Remover"
                                                    >
                                                        <ClearIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-white/20">
                                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                            </svg>
                                                        </div>
                                                        <p className="text-brand-med-gray italic font-medium">Nenhum cadastro personalizado encontrado. Use o botão acima para adicionar.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 p-8 bg-brand-accent/5 border border-brand-accent/10 rounded-3xl animate-fade-in flex gap-6 items-center">
                        <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </div>
                        <p className="text-brand-med-gray font-medium leading-relaxed">
                            <strong>Nota:</strong> As opções cadastradas aqui serão mescladas com a base padrão do sistema. Ao criar uma nova tarefa, elas aparecerão automaticamente nos seletores de Disciplina, Nível e Título da Atividade.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SystemPage;
