import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataProvider';
import { TaskStatus, RestrictionType, RestrictionPriority } from '../types';
import CumulativeProgressChart from './CumulativeProgressChart';
import RestrictionsRadarChart from './RestrictionsRadarChart';
import AssigneeSummaryChart from './AssigneeSummaryChart';
import TvIcon from './icons/TvIcon';
import MegaphoneIcon from './icons/MegaphoneIcon';
import AlertIcon from './icons/AlertIcon';
import XIcon from './icons/XIcon';
import PlusIcon from './icons/PlusIcon';

interface WarRoomPageProps {
    onNavigateToHome: () => void;
}

const WARNINGS_STORAGE_KEY = 'war_room_warnings';

const DEFAULT_WARNINGS = [
    "Segurança do Trabalho: 125 dias sem acidentes",
    "Previsão: Sol com nuvens, 28°C",
    "Aviso: Reunião de Planejamento Sexta-feira às 14h",
    "Meta da Semana: Concretar Laje do 2º Pavimento",
    "Efetivo em Obra: 45 Colaboradores"
];

const WarRoomPage: React.FC<WarRoomPageProps> = ({ onNavigateToHome }) => {
    const { tasks, baselineTasks, restrictions, allUsers } = useData();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [timer, setTimer] = useState(20);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Warnings Management
    const [warnings, setWarnings] = useState<string[]>(() => {
        const saved = localStorage.getItem(WARNINGS_STORAGE_KEY);
        return saved ? JSON.parse(saved) : DEFAULT_WARNINGS;
    });
    const [isWarningsModalOpen, setIsWarningsModalOpen] = useState(false);
    const [newWarning, setNewWarning] = useState('');

    // Slides (Weather removed)
    const slides = ['PERFORMANCE', 'RESTRICTIONS', 'HALL_OF_FAME', 'MEDIA'];

    // Fullscreen Toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error(err));
        }
    };

    // Warnings handlers
    const addWarning = () => {
        if (!newWarning.trim()) return;
        const updated = [...warnings, newWarning.trim()];
        setWarnings(updated);
        localStorage.setItem(WARNINGS_STORAGE_KEY, JSON.stringify(updated));
        setNewWarning('');
    };

    const removeWarning = (index: number) => {
        const updated = warnings.filter((_, i) => i !== index);
        setWarnings(updated);
        localStorage.setItem(WARNINGS_STORAGE_KEY, JSON.stringify(updated));
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                setCurrentSlide((prev) => (prev + 1) % slides.length);
                setIsTransitioning(false);
            } else if (e.key === 'ArrowLeft') {
                setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
                setIsTransitioning(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slides.length]);

    // --- DATA PREPARATION ---

    // 1. Critical Restrictions
    const criticalRestrictions = useMemo(() => {
        return restrictions
            .filter(r => r.status !== 'Resolvida' && (r.priority === RestrictionPriority.Critical || r.priority === RestrictionPriority.High))
            .sort((a, b) => a.priority === RestrictionPriority.Critical ? -1 : 1)
            .slice(0, 5);
    }, [restrictions]);

    // 2. Completed Tasks with Real Photos (Last Week + This Week)
    const completedTasksWithPhotos = useMemo(() => {
        const now = new Date();
        const startOfPeriod = new Date(now);
        startOfPeriod.setDate(now.getDate() - now.getDay() - 7); // Sunday of last week
        startOfPeriod.setHours(0, 0, 0, 0);

        const endOfPeriod = new Date(now);
        endOfPeriod.setHours(23, 59, 59, 999);

        const completed = tasks.filter(t => {
            if (t.status !== TaskStatus.Completed) return false;
            if (!t.photos || t.photos.length === 0) return false;

            if (!t.dueDate) return false;
            const taskDate = new Date(t.dueDate);
            return taskDate >= startOfPeriod && taskDate <= endOfPeriod;
        });

        return completed.map(t => ({
            ...t,
            photoUrl: t.photos![0]
        })).slice(0, 15); // Increased limit slightly to accommodate more photos
    }, [tasks]);

    // 3. Hall of Fame Data
    const hallOfFame = useMemo(() => {
        const taskCounts: Record<string, number> = {};
        const restrictionCounts: Record<string, number> = {};

        // Helper to normalize names (simple uppercase for grouping)
        const normalize = (name: string) => name ? name.trim() : 'Desconhecido';

        tasks.forEach(t => {
            if (t.status === TaskStatus.Completed && t.assignee) {
                const name = normalize(t.assignee);
                taskCounts[name] = (taskCounts[name] || 0) + 1;
            }
        });

        restrictions.forEach(r => {
            if (r.status === 'Resolvida' && r.responsible) {
                const name = normalize(r.responsible);
                restrictionCounts[name] = (restrictionCounts[name] || 0) + 1;
            }
        });

        const topTaskSolvers = Object.entries(taskCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([name, count], index) => ({ name, count, rank: index + 1 }));

        const topRestrictionSolvers = Object.entries(restrictionCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([name, count], index) => ({ name, count, rank: index + 1 }));

        return { topTaskSolvers, topRestrictionSolvers };
    }, [tasks, restrictions]);

    // 4. Recent News (Real-time Events)
    const recentNews = useMemo(() => {
        const events: string[] = [];
        const now = new Date();
        const timeWindow = 48 * 60 * 60 * 1000; // Last 48 hours for "news" effect

        // Recent Completed Tasks
        tasks.forEach(t => {
            if (t.status === TaskStatus.Completed) {
                const dateStr = t.actualEndDate || t.dueDate;
                if (dateStr) {
                    const date = new Date(dateStr);
                    if (now.getTime() - date.getTime() < timeWindow && now.getTime() >= date.getTime()) {
                        events.push(`🏆 Tarefa Concluída: ${t.title} por ${t.assignee}`);
                    }
                }
            }
        });

        // Recent Resolved Restrictions
        restrictions.forEach(r => {
            if (r.status === 'Resolvida' && r.resolved_at) {
                const date = new Date(r.resolved_at);
                if (now.getTime() - date.getTime() < timeWindow && now.getTime() >= date.getTime()) {
                    events.push(`🔓 Restrição Resolvida: ${r.description} (${r.responsible})`);
                }
            }
        });

        return events;
    }, [tasks, restrictions]);

    // Combine warnings and news
    const tickerItems = useMemo(() => [...warnings, ...recentNews], [warnings, recentNews]);

    // Auto-rotate slides
    useEffect(() => {
        // 1. Set initial timer for the current slide
        const duration = slides[currentSlide] === 'MEDIA'
            ? (completedTasksWithPhotos.length > 0 ? Math.max(20, completedTasksWithPhotos.length * 10) : 20)
            : 20;

        setTimer(duration);

        // 2. Start countdown
        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setCurrentSlide((curr) => (curr + 1) % slides.length);
                        setIsTransitioning(false);
                    }, 500);
                    return 1; // Hold at 1 until effect resets on slide change
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [currentSlide, slides.length, completedTasksWithPhotos.length]);


    // --- RENDER SLIDES ---

    const renderSlideContent = () => {
        switch (slides[currentSlide]) {
            case 'PERFORMANCE':
                return (
                    <div className={`transition-all duration-500 ease-in-out transform ${isTransitioning ? 'opacity-0 -translate-x-12 scale-95 blur-sm' : 'opacity-100 translate-x-0 scale-100 blur-0'} h-full`}>
                        <div key="performance" className="grid grid-cols-2 gap-8 h-full px-12">
                            {/* Left: Accumulated PPC (S-Curve) */}
                            <div className="flex flex-col h-full bg-[#111827]/40 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:border-brand-accent/30 transition-colors duration-500">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-brand-accent/5 rounded-full blur-[100px] -mr-20 -mt-20 group-hover:bg-brand-accent/10 transition-all duration-700"></div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3 relative z-10">
                                    <span className="w-1.5 h-8 bg-brand-accent rounded-full shadow-[0_0_15px_rgba(227,90,16,0.8)]"></span>
                                    Avanço Físico Acumulado (PPC)
                                </h2>
                                <div className="flex-1 min-h-0 relative z-10">
                                    <CumulativeProgressChart tasks={tasks} baselineTasks={baselineTasks} />
                                </div>
                            </div>

                            {/* Right: Top Performance */}
                            <div className="flex flex-col h-full bg-[#111827]/40 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-colors duration-500">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] -mr-20 -mt-20 group-hover:bg-blue-500/10 transition-all duration-700"></div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3 relative z-10">
                                    <span className="w-1.5 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]"></span>
                                    Top Performance
                                </h2>
                                <div className="flex-1 overflow-visible relative z-10">
                                    <AssigneeSummaryChart tasks={tasks} />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'RESTRICTIONS':
                return (
                    <div className={`transition-all duration-500 ease-in-out transform ${isTransitioning ? 'opacity-0 -translate-x-12 scale-95 blur-sm' : 'opacity-100 translate-x-0 scale-100 blur-0'} h-full`}>
                        <div key="restrictions" className="grid grid-cols-2 gap-8 h-full px-12">
                            {/* Left: Radar */}
                            <div className="flex flex-col items-center justify-center bg-[#111827]/40 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md relative group hover:border-red-500/30 transition-colors duration-500">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-[100px] -mr-20 -mt-20 group-hover:bg-red-500/10 transition-all duration-700"></div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-8 self-start flex items-center gap-3 relative z-10">
                                    <span className="w-1.5 h-8 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)]"></span>
                                    Mapa de Restrições
                                </h2>
                                <div className="w-full h-full max-h-[500px] relative z-10">
                                    <RestrictionsRadarChart restrictions={restrictions} />
                                </div>
                            </div>

                            {/* Right: Critical List */}
                            <div className="flex flex-col bg-[#111827]/40 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md relative overflow-hidden group hover:border-orange-500/30 transition-colors duration-500">
                                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3 relative z-10">
                                    <span className="w-1.5 h-8 bg-orange-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.8)]"></span>
                                    Pontos de Atenção (Críticos)
                                </h2>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar relative z-10">
                                    {criticalRestrictions.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 animate-float">
                                            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                                <span className="text-5xl">✨</span>
                                            </div>
                                            <p className="text-green-500 text-xl font-bold uppercase tracking-widest">Nenhuma Restrição Crítica!</p>
                                        </div>
                                    ) : (
                                        criticalRestrictions.map((r, idx) => (
                                            <div
                                                key={r.id}
                                                className="bg-gradient-to-r from-red-500/10 to-transparent border-l-4 border-red-500 p-6 rounded-r-xl relative overflow-hidden hover:bg-red-500/20 transition-all duration-300 group/item"
                                                style={{ animationDelay: `${idx * 100}ms` }}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded uppercase tracking-wider shadow-lg shadow-red-500/30">{r.priority}</span>
                                                        <span className="text-xs text-red-300 font-bold uppercase tracking-wide">{r.type}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-red-200 opacity-70 bg-black/30 px-2 py-1 rounded">{r.due_date ? new Date(r.due_date).toLocaleDateString('pt-BR') : 'S/ Data'}</span>
                                                </div>
                                                <p className="text-lg font-bold text-white leading-tight group-hover/item:text-red-100 transition-colors">{r.description}</p>
                                                <div className="mt-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3 text-xs text-red-300">
                                                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-[10px] font-black border border-red-500/30">{r.responsible.charAt(0)}</div>
                                                        <span className="uppercase font-bold tracking-wider">{r.responsible}</span>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-red-400 opacity-60 uppercase tracking-widest">ID: #{r.id.slice(-4)}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'HALL_OF_FAME':
                return (
                    <div className={`transition-all duration-500 ease-in-out transform ${isTransitioning ? 'opacity-0 -translate-x-12 scale-95 blur-sm' : 'opacity-100 translate-x-0 scale-100 blur-0'} h-full`}>
                        <div key="hall-of-fame" className="grid grid-cols-2 gap-8 h-full px-12 relative">
                            {/* Central Spotlight Effect */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-transparent via-white/5 to-transparent blur-[100px] rotate-45 pointer-events-none"></div>

                            {/* Column 1: Task Masters */}
                            <div className="flex flex-col h-full bg-[#111827]/40 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-60 h-60 bg-yellow-500/10 rounded-full blur-[80px] -mr-10 -mt-10"></div>
                                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 uppercase tracking-widest mb-10 text-center drop-shadow-sm flex items-center justify-center gap-3">
                                    <span className="text-4xl">👑</span> Mestres da Execução
                                </h2>

                                <div className="flex flex-col gap-6 items-center justify-center flex-1">
                                    {hallOfFame.topTaskSolvers.length === 0 ? (
                                        <p className="text-gray-500 uppercase tracking-widest">Sem dados ainda</p>
                                    ) : (
                                        hallOfFame.topTaskSolvers.map((user, idx) => (
                                            <div key={idx} className={`relative w-full max-w-md ${idx === 0 ? 'scale-110 mb-6 z-10' : 'scale-100 opacity-90'}`}>
                                                <div className={`p-6 rounded-2xl border backdrop-blur-xl flex items-center gap-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.02] ${idx === 0
                                                        ? 'bg-gradient-to-r from-yellow-500/20 to-black/60 border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.2)]'
                                                        : 'bg-white/5 border-white/10'
                                                    }`}>
                                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl shadow-lg border-2 ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black border-yellow-300' : 'bg-gray-700 text-gray-300 border-gray-600'
                                                        }`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`text-sm font-bold uppercase tracking-widest mb-1 ${idx === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                                            {idx === 0 ? 'O Grande Campeão' : `Rank #${idx + 1}`}
                                                        </p>
                                                        <h3 className="text-2xl font-black text-white leading-none mb-1 truncate">{user.name}</h3>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${idx === 0 ? 'bg-yellow-500' : 'bg-gray-500'}`} style={{ width: '100%' }}></div>
                                                            </div>
                                                            <span className="text-xl font-bold text-white">{user.count}</span>
                                                            <span className="text-[10px] text-gray-400 uppercase">Tarefas</span>
                                                        </div>
                                                    </div>
                                                    {idx === 0 && <div className="absolute -top-6 -right-4 text-6xl drop-shadow-lg filter rotate-12 animate-pulse">🏆</div>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Restriction Breakers */}
                            <div className="flex flex-col h-full bg-[#111827]/40 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full blur-[80px] -ml-10 -mt-10"></div>
                                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-blue-600 uppercase tracking-widest mb-10 text-center drop-shadow-sm flex items-center justify-center gap-3">
                                    <span className="text-4xl">🛡️</span> Guardiões da Qualidade
                                </h2>

                                <div className="flex flex-col gap-6 items-center justify-center flex-1">
                                    {hallOfFame.topRestrictionSolvers.length === 0 ? (
                                        <p className="text-gray-500 uppercase tracking-widest">Sem dados ainda</p>
                                    ) : (
                                        hallOfFame.topRestrictionSolvers.map((user, idx) => (
                                            <div key={idx} className={`relative w-full max-w-md ${idx === 0 ? 'scale-110 mb-6 z-10' : 'scale-100 opacity-90'}`}>
                                                <div className={`p-6 rounded-2xl border backdrop-blur-xl flex items-center gap-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-500 hover:scale-[1.02] ${idx === 0
                                                        ? 'bg-gradient-to-l from-blue-500/20 to-black/60 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)]'
                                                        : 'bg-white/5 border-white/10'
                                                    }`}>
                                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl shadow-lg border-2 ${idx === 0 ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white border-blue-300' : 'bg-gray-700 text-gray-300 border-gray-600'
                                                        }`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 text-right">
                                                        <p className={`text-sm font-bold uppercase tracking-widest mb-1 ${idx === 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                                            {idx === 0 ? 'O Resolvedor Supremo' : `Rank #${idx + 1}`}
                                                        </p>
                                                        <h3 className="text-2xl font-black text-white leading-none mb-1 truncate">{user.name}</h3>
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <span className="text-[10px] text-gray-400 uppercase">Restrições</span>
                                                            <span className="text-xl font-bold text-white">{user.count}</span>
                                                            <div className="h-1.5 w-24 bg-gray-700 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${idx === 0 ? 'bg-blue-500' : 'bg-gray-500'}`} style={{ width: '100%' }}></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {idx === 0 && <div className="absolute -top-6 -left-4 text-6xl drop-shadow-lg filter -rotate-12 animate-pulse">💎</div>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'MEDIA':
                // Carousel of completed tasks - Distribute all photos evenly across the dynamic duration
                const totalDuration = completedTasksWithPhotos.length > 0 ? Math.max(20, completedTasksWithPhotos.length * 10) : 20;
                const photoCount = completedTasksWithPhotos.length;
                const elapsedTime = totalDuration - timer;
                const photoIndex = photoCount > 0 ? Math.floor((elapsedTime / totalDuration) * photoCount) : 0;
                const safeIndex = Math.min(photoIndex, photoCount - 1);

                const activePhotoTask = photoCount > 0 ? completedTasksWithPhotos[safeIndex] : null;

                // Identify author of the comment if possible
                const authorName = activePhotoTask ? (allUsers.find(u => u.id === activePhotoTask.user_id)?.fullName || activePhotoTask.assignee) : '';

                return (
                    <div className={`transition-all duration-500 ease-in-out transform ${isTransitioning ? 'opacity-0 -translate-x-12 scale-95 blur-sm' : 'opacity-100 translate-x-0 scale-100 blur-0'} h-full`}>
                        <div key="media" className="flex flex-col h-full px-12 relative">
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3 absolute top-0 left-12 z-30 drop-shadow-lg">
                                <span className="w-1.5 h-8 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.8)]"></span>
                                Diário de Obra Visual
                            </h2>

                            {activePhotoTask ? (
                                <div key={activePhotoTask.id} className="flex-1 rounded-[3rem] overflow-hidden relative shadow-2xl border border-white/10 group animate-fade-in-up">
                                    <img
                                        src={activePhotoTask.photoUrl}
                                        className="w-full h-full object-cover transition-transform duration-[20s] ease-linear scale-100 group-hover:scale-110"
                                        alt="Activity"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent">
                                        <div className="absolute bottom-0 left-0 w-full p-16">
                                            <div className="flex items-end justify-between animate-slide-up">
                                                <div className="max-w-4xl space-y-6">
                                                    <div className="flex items-center gap-4">
                                                        <span className="bg-green-500 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.4)] border border-green-400/30">Concluído</span>
                                                        <span className="text-gray-300 font-bold uppercase tracking-wider text-sm bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                                                            {activePhotoTask.location}
                                                            {activePhotoTask.corte ? ` - ${activePhotoTask.corte}` : ''}
                                                            {activePhotoTask.support ? ` - ${activePhotoTask.support}` : ''}
                                                        </span>
                                                    </div>
                                                    <h1 className="text-7xl font-black text-white leading-none tracking-tight drop-shadow-2xl">{activePhotoTask.title}</h1>
                                                    <div className="flex items-center gap-8 mt-6 bg-black/40 backdrop-blur-xl p-6 rounded-3xl border border-white/10 inline-flex">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm font-black shadow-lg">
                                                                {activePhotoTask.assignee.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Responsável</p>
                                                                <p className="text-lg font-bold text-white">{activePhotoTask.assignee}</p>
                                                            </div>
                                                        </div>
                                                        <div className="h-10 w-px bg-white/10"></div>
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Data de Conclusão</p>
                                                            <p className="text-lg font-bold text-white">{activePhotoTask.dueDate ? new Date(activePhotoTask.dueDate).toLocaleDateString('pt-BR') : 'Hoje'}</p>
                                                        </div>
                                                    </div>
                                                </div>


                                                {/* RDO Note */}
                                                {activePhotoTask.observations && (
                                                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 max-w-sm shadow-2xl skew-x-[-2deg] hover:skew-x-0 transition-transform duration-500">
                                                        <div className="w-8 h-1 bg-brand-accent mb-4 rounded-full"></div>
                                                        <p className="text-sm text-gray-200 italic font-medium leading-relaxed">"{activePhotoTask.observations}"</p>
                                                        <p className="text-[10px] text-gray-400 font-black uppercase mt-4 text-right tracking-widest flex items-center justify-end gap-2">
                                                            <span className="w-1.5 h-1.5 bg-brand-accent rounded-full"></span>
                                                            {authorName}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 rounded-[3rem] bg-[#111827]/40 border border-white/10 flex flex-col items-center justify-center text-center animate-float backdrop-blur-md">
                                    <div className="p-8 bg-white/5 rounded-full mb-6">
                                        <PlusIcon className="w-24 h-24 text-white/10" />
                                    </div>
                                    <p className="text-3xl text-gray-500 font-bold mb-3 uppercase tracking-widest">Galeria Vazia</p>
                                    <p className="text-gray-600">Adicione fotos às tarefas concluídas para exibi-las aqui.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default: return null;
        }
    };

    return (
        <div className="w-screen h-screen bg-gradient-to-br from-gray-900 via-[#050b14] to-black text-white overflow-hidden relative flex flex-col font-sans selection:bg-brand-accent selection:text-white animate-gradient-xy bg-[length:400%_400%]">
            {/* Background Texture with Grid */}
            <div className="absolute inset-0 bg-[#020617]">
                {/* Cyber Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

                {/* Moving light spots */}
                <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-brand-accent/5 to-transparent blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] animate-float"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-2s' }}></div>
            </div>

            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start z-50">
                <div className="flex items-center gap-5 bg-black/20 backdrop-blur-xl p-3 pr-8 rounded-[2rem] border border-white/10 shadow-2xl transition-all duration-300 hover:bg-black/30 hover:border-white/20 hover:scale-[1.02]">
                    <div className="w-16 h-16 bg-gradient-to-br from-brand-accent to-orange-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(227,90,16,0.3)] border border-white/10">
                        <TvIcon className="w-8 h-8 text-white drop-shadow-md" />
                    </div>
                    <div className="pr-2">
                        <h1 className="text-4xl font-black uppercase tracking-widest leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">War Room</h1>
                        <p className="text-[10px] text-brand-med-gray font-bold tracking-[0.3em] mt-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-blink shadow-[0_0_10px_#22c55e]"></span>
                            MONITORAMENTO AO VIVO
                        </p>
                    </div>
                </div>

                {/* Timer & Controls */}
                <div className="flex items-center gap-6 bg-black/20 backdrop-blur-xl p-3 rounded-[2rem] border border-white/10 shadow-2xl">
                    <div className="flex gap-3 px-6">
                        {slides.map((slide, idx) => (
                            <button
                                key={slide}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-2.5 rounded-full transition-all duration-700 ${currentSlide === idx
                                    ? 'w-12 bg-gradient-to-r from-brand-accent to-orange-500 shadow-[0_0_20px_rgba(227,90,16,0.5)]'
                                    : 'w-2.5 bg-white/10 hover:bg-white/30 hover:scale-125'}`}
                            />
                        ))}
                    </div>

                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-lg text-brand-accent relative overflow-hidden group">
                        <span className="relative z-10 group-hover:scale-110 transition-transform">{timer}</span>
                        <div
                            className="absolute bottom-0 left-0 w-full bg-brand-accent/10 transition-all duration-1000 ease-linear"
                            style={{ height: `${(timer / 20) * 100}%` }}
                        ></div>
                    </div>

                    <div className="w-px h-10 bg-white/10 mx-1"></div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsWarningsModalOpen(true)}
                            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-yellow-500 hover:scale-105 active:scale-95 group"
                            title="Editar Avisos"
                        >
                            <span className="text-xl group-hover:animate-bounce-slow">📢</span>
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-white hover:scale-105 active:scale-95"
                            title="Tela Cheia"
                        >
                            {isFullscreen ? (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            )}
                        </button>

                        <button onClick={onNavigateToHome} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-all border border-white/10 group active:scale-95">
                            <XIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative z-10 pt-36 pb-20 overflow-hidden">
                {renderSlideContent()}
            </div>

            {/* Footer Ticker */}
            <div className="h-16 bg-[#0a0f18] border-t border-white/10 flex items-center overflow-hidden whitespace-nowrap z-50 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black via-black/80 to-transparent z-20"></div>
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black via-black/80 to-transparent z-20"></div>

                <div
                    className="animate-[marquee-ltr_60s_linear_infinite] flex gap-16 text-lg font-bold text-gray-300 uppercase tracking-widest pl-full items-center"
                >
                    {tickerItems.map((w, i) => (
                        <span key={i} className="flex items-center gap-3">
                            {/* Replaced Dot with Megaphone Icon for all messages */}
                            <MegaphoneIcon className={`w-6 h-6 animate-pulse ${w.includes('🏆') ? 'text-yellow-500' : (w.includes('🔓') ? 'text-green-500' : 'text-red-500')}`} />
                            {w}
                        </span>
                    ))}
                </div>
            </div>

            {/* Warnings Modal */}
            {isWarningsModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsWarningsModalOpen(false)}>
                    <div className="bg-[#111827] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-wider text-white">Gerenciar Avisos</h3>
                            <button onClick={() => setIsWarningsModalOpen(false)} className="text-gray-500 hover:text-white"><XIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newWarning}
                                    onChange={e => setNewWarning(e.target.value)}
                                    placeholder="Digite um novo aviso..."
                                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-accent outline-none"
                                />
                                <button onClick={addWarning} className="bg-brand-accent text-white px-4 rounded-xl font-bold hover:bg-[#e35a10]"><PlusIcon className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {warnings.map((w, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                        <p className="text-sm text-gray-300 font-medium truncate pr-4">{w}</p>
                                        <button onClick={() => removeWarning(i)} className="text-red-500 hover:text-red-400 font-bold text-xs uppercase hover:bg-red-500/10 p-2 rounded">Remover</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarRoomPage;
