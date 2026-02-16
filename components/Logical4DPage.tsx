
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataProvider';
import Sidebar from './Sidebar';
import Header from './Header';
import { User, Task } from '../types';
import ConstructionIcon from './icons/ConstructionIcon';

interface Logical4DPageProps {
    user: User;
    onLogout: () => void;
    onNavigateToHome: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToReports: () => void;
    onNavigateToBaseline: () => void;
    onNavigateToCurrentSchedule: () => void;
    onNavigateToAnalysis: () => void;
    onNavigateToLean: () => void;
    onNavigateToLeanConstruction: () => void;
    onNavigateToCost: () => void;
    onUpgradeClick: () => void;
}

const Logical4DPage: React.FC<Logical4DPageProps> = ({
    user,
    onLogout,
    onNavigateToHome,
    onNavigateToDashboard,
    onNavigateToReports,
    onNavigateToBaseline,
    onNavigateToCurrentSchedule,
    onNavigateToAnalysis,
    onNavigateToLean,
    onNavigateToLeanConstruction,
    onNavigateToCost,
    onUpgradeClick
}) => {
    const { currentScheduleTasks } = useData();

    // --- State for 4D Simulation ---
    // Calculate date range
    const { minDate, maxDate } = useMemo(() => {
        if (currentScheduleTasks.length === 0) return { minDate: new Date(), maxDate: new Date() };
        const dates = currentScheduleTasks.flatMap(t => [new Date(t.startDate), new Date(t.dueDate)]);
        return {
            minDate: new Date(Math.min(...dates.map(d => d.getTime()))),
            maxDate: new Date(Math.max(...dates.map(d => d.getTime())))
        };
    }, [currentScheduleTasks]);

    const [currentSimDate, setCurrentSimDate] = useState<Date>(minDate);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // Days per tick
    const animationRef = useRef<number | null>(null);

    // Group tasks by Level -> Discipline/Location
    const structure = useMemo(() => {
        const levels = Array.from(new Set(currentScheduleTasks.map(t => t.level || 'N/A'))) as string[];
        // Custom sort logic could go here to put 'Térreo' at bottom, etc.
        // For now, alphabetical or simple sort. 
        // Let's try to infer heuristics: 'Subsolo' < 'Térreo' < '1' < '2'...
        const levelOrder = ['Fundação', 'Subsolo', 'Térreo', '1º Pavimento', '2º Pavimento', '3º Pavimento', 'Cobertura', 'Ático'];

        levels.sort((a, b) => {
            const idxA = levelOrder.findIndex(l => a.includes(l));
            const idxB = levelOrder.findIndex(l => b.includes(l));
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            return a.localeCompare(b);
        });

        // Reverse for stacking (Bottom up)
        return levels.reverse();
    }, [currentScheduleTasks]);

    // Animation Loop
    useEffect(() => {
        if (isPlaying) {
            const animate = () => {
                setCurrentSimDate(prev => {
                    const nextDate = new Date(prev);
                    nextDate.setDate(prev.getDate() + playbackSpeed);
                    if (nextDate > maxDate) {
                        setIsPlaying(false);
                        return maxDate;
                    }
                    return nextDate;
                });
                animationRef.current = requestAnimationFrame(animate);
                // Throttle animation for better visual? requestAnimationFrame is 60fps, might be too fast for days.
                // Using setTimeout inside might be better or just let it fly.
            };
            // Slow down the loop slightly
            const timer = setTimeout(() => {
                animationRef.current = requestAnimationFrame(animate);
            }, 100);

            return () => clearTimeout(timer);
        } else {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }
    }, [isPlaying, maxDate, playbackSpeed]);

    // Helper to check task status at currentSimDate
    const getTaskStatusAtDate = (task: Task) => {
        const start = new Date(task.startDate);
        const end = new Date(task.dueDate);
        const sim = currentSimDate;

        if (sim < start) return 'pending';
        if (sim >= start && sim <= end) return 'active';
        return 'completed';
    };

    const getSimProgress = () => {
        const totalDuration = maxDate.getTime() - minDate.getTime();
        const currentDuration = currentSimDate.getTime() - minDate.getTime();
        return totalDuration === 0 ? 0 : (currentDuration / totalDuration) * 100;
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const percent = Number(e.target.value);
        const totalDuration = maxDate.getTime() - minDate.getTime();
        const newTime = minDate.getTime() + (totalDuration * (percent / 100));
        setCurrentSimDate(new Date(newTime));
    };

    return (
        <div className="flex h-screen bg-[#060a12] overflow-hidden">
            <Sidebar
                user={user}
                activeScreen="logical4d"
                onNavigateToHome={onNavigateToHome}
                onNavigateToDashboard={onNavigateToDashboard}
                onNavigateToReports={onNavigateToReports}
                onNavigateToBaseline={onNavigateToBaseline}
                onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                onNavigateToAnalysis={onNavigateToAnalysis}
                onNavigateToLean={onNavigateToLean}
                onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                onNavigateToCost={onNavigateToCost}
                onUpgradeClick={onUpgradeClick}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-brand-darkest/50 relative">
                <Header
                    user={user}
                    onLogout={onLogout}
                    activeScreen="logical4d"
                    onNavigateToHome={onNavigateToHome}
                    onNavigateToDashboard={onNavigateToDashboard}
                    onNavigateToReports={onNavigateToReports}
                    onNavigateToBaseline={onNavigateToBaseline}
                    onNavigateToCurrentSchedule={onNavigateToCurrentSchedule}
                    onNavigateToAnalysis={onNavigateToAnalysis}
                    onNavigateToLean={onNavigateToLean}
                    onNavigateToLeanConstruction={onNavigateToLeanConstruction}
                    onNavigateToCost={onNavigateToCost}
                    onUpgradeClick={onUpgradeClick}
                />

                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Background Grid Effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:40px_40px] perspective-1000 transform-style-3d pointer-events-none"></div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex gap-6 p-6 overflow-hidden">

                        {/* 3D/Schematic View Window */}
                        <div className="flex-1 bg-[#111827]/50 border border-brand-accent/20 rounded-3xl relative overflow-hidden flex flex-col shadow-[0_0_50px_rgba(34,211,238,0.05)_inset]">
                            <div className="absolute top-0 right-0 p-4 z-10">
                                <span className="bg-black/50 border border-white/10 px-3 py-1 rounded-full text-xs font-mono text-cyan-400 animate-pulse">
                                    LIVE SIMULATION VIEW
                                </span>
                            </div>

                            {/* Building Stack Visualization */}
                            <div className="flex-1 overflow-y-auto p-10 flex flex-col justify-end items-center gap-4 custom-scrollbar">
                                {structure.map(level => {
                                    // Tasks for this level
                                    const levelTasks = currentScheduleTasks.filter(t => t.level === level);

                                    // Check if level has ANY activity
                                    const hasActivity = levelTasks.some(t => getTaskStatusAtDate(t) === 'active');
                                    const isCompleted = levelTasks.every(t => getTaskStatusAtDate(t) === 'completed') && levelTasks.length > 0;

                                    // Disciplines/Tasks in this level
                                    // We can show blocks representing tasks
                                    return (
                                        <div key={level} className={`w-full max-w-4xl relative transition-all duration-500 ${hasActivity ? 'scale-105' : 'scale-100'}`}>
                                            {/* Level Label */}
                                            <div className="absolute -left-20 top-1/2 -translate-y-1/2 text-right w-16">
                                                <span className={`text-xs font-black uppercase tracking-widest ${hasActivity ? 'text-white text-shadow-glow' : 'text-gray-600'}`}>
                                                    {level}
                                                </span>
                                            </div>

                                            {/* Floor Plate */}
                                            <div className={`
                                                relative h-16 rounded-lg border-2 border-white/5 
                                                flex items-center px-4 gap-2 
                                                transition-all duration-500
                                                ${isCompleted
                                                    ? 'bg-green-900/20 border-green-500/30'
                                                    : hasActivity
                                                        ? 'bg-cyan-900/20 border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
                                                        : 'bg-[#0a0f18]/80 border-white/5'
                                                }
                                                perspective-1000 group
                                            `}>
                                                {/* Tasks Blocks inside the Floor */}
                                                {levelTasks.map(task => {
                                                    const status = getTaskStatusAtDate(task);
                                                    if (status === 'pending') return null; // Don't show yet? Or show ghost?

                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className={`
                                                                h-10 min-w-[60px] flex-1 rounded text-[8px] font-bold uppercase flex items-center justify-center text-center p-1 border transition-all duration-500
                                                                ${status === 'active'
                                                                    ? 'bg-brand-accent animate-pulse text-white border-white/20 shadow-lg scale-110 z-10'
                                                                    : 'bg-green-500/20 text-green-400 border-green-500/30'
                                                                }
                                                            `}
                                                            title={task.title}
                                                        >
                                                            <span className="truncate w-full">{task.discipline || task.title}</span>
                                                        </div>
                                                    );
                                                })}

                                                {levelTasks.length === 0 && (
                                                    <span className="text-[10px] text-gray-700 w-full text-center">SEM ATIVIDADES</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Base Plate */}
                            <div className="h-4 w-full bg-gradient-to-t from-cyan-900/20 to-transparent mt-0 opacity-50"></div>
                        </div>

                        {/* Info Panel / Stats */}
                        <div className="w-80 flex flex-col gap-4">
                            <div className="bg-[#111827] rounded-2xl border border-white/10 p-6 flex flex-col gap-4">
                                <div>
                                    <h3 className="text-sm font-black text-brand-med-gray uppercase tracking-widest">Data da Simulação</h3>
                                    <p className="text-3xl font-black text-white font-mono">{currentSimDate.toLocaleDateString('pt-BR')}</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Linha do Tempo</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={getSimProgress()}
                                        onChange={handleSliderChange}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-accent hover:accent-orange-400"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                        <span>{minDate.toLocaleDateString()}</span>
                                        <span>{maxDate.toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${isPlaying ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-brand-accent text-white hover:bg-orange-600 shadow-brand-accent/20 hover:shadow-lg'}`}
                                    >
                                        {isPlaying ? (
                                            <>
                                                <span className="w-2 h-2 bg-red-400 rounded-sm"></span> Pause
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[8px] border-l-white border-b-[4px] border-b-transparent"></span> Play
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Speed:</span>
                                    <button onClick={() => setPlaybackSpeed(1)} className={`px-2 py-1 rounded text-xs font-bold ${playbackSpeed === 1 ? 'bg-white/10 text-white' : 'text-gray-500'}`}>1x</button>
                                    <button onClick={() => setPlaybackSpeed(3)} className={`px-2 py-1 rounded text-xs font-bold ${playbackSpeed === 3 ? 'bg-white/10 text-white' : 'text-gray-500'}`}>3x</button>
                                    <button onClick={() => setPlaybackSpeed(7)} className={`px-2 py-1 rounded text-xs font-bold ${playbackSpeed === 7 ? 'bg-white/10 text-white' : 'text-gray-500'}`}>7x</button>
                                </div>
                            </div>

                            {/* Active Tasks List for Date */}
                            <div className="flex-1 bg-[#111827] rounded-2xl border border-white/10 p-6 overflow-hidden flex flex-col">
                                <h3 className="text-sm font-black text-brand-med-gray uppercase tracking-widest mb-4">Atividades Ativas</h3>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                    {currentScheduleTasks.filter(t => getTaskStatusAtDate(t) === 'active').length === 0 ? (
                                        <p className="text-xs text-gray-600 text-center py-10">Nenhuma atividade nesta data.</p>
                                    ) : (
                                        currentScheduleTasks.filter(t => getTaskStatusAtDate(t) === 'active').map(task => (
                                            <div key={task.id} className="p-3 bg-white/5 border-l-2 border-brand-accent rounded hover:bg-white/10 transition-colors">
                                                <p className="text-xs font-bold text-white leading-tight">{task.title}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{task.level} • {task.discipline}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Logical4DPage;
