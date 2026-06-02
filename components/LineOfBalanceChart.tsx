import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { oaeLocations } from '../utils/constants';

interface LineOfBalanceChartProps {
    tasks: Task[];
}

// ==========================================
// Equipes de Obras de Arte — classificação pela atividade (título/nível)
// ESTACA · ARRASAMENTO · ARMAÇÃO · FORMA (forma e desforma) · CONCRETO
// ==========================================
type TeamKey = 'ESTACA' | 'ARRASAMENTO' | 'ARMACAO' | 'FORMA' | 'CONCRETO' | 'OUTROS';

const TEAM_ORDER: TeamKey[] = ['ESTACA', 'ARRASAMENTO', 'ARMACAO', 'FORMA', 'CONCRETO', 'OUTROS'];

const TEAM_COLORS: Record<TeamKey, string> = {
    ESTACA: '#f59e0b',
    ARRASAMENTO: '#ef4444',
    ARMACAO: '#3b82f6',
    FORMA: '#a855f7',
    CONCRETO: '#10b981',
    OUTROS: '#64748b',
};

const TEAM_LABELS: Record<TeamKey, string> = {
    ESTACA: 'Estaca',
    ARRASAMENTO: 'Arrasamento',
    ARMACAO: 'Armação',
    FORMA: 'Forma / Desforma',
    CONCRETO: 'Concreto',
    OUTROS: 'Outros',
};

const norm = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const classifyTeam = (t: Task): TeamKey => {
    const s = `${norm(t.title)} ${norm(t.level)}`;
    if (s.includes('arrasamento')) return 'ARRASAMENTO';      // antes de "estaca" (arrasamento das estacas)
    if (s.includes('estaca')) return 'ESTACA';
    if (s.includes('concret')) return 'CONCRETO';
    if (s.includes('forma') || s.includes('desforma')) return 'FORMA'; // "forma" já cobre "desforma"
    if (s.includes('armac')) return 'ARMACAO';
    return 'OUTROS';
};

const DAY_MS = 86400000;

const LineOfBalanceChart: React.FC<LineOfBalanceChartProps> = ({ tasks }) => {
    const [dayW, setDayW] = useState(16); // largura de 1 dia em px (zoom)

    const model = useMemo(() => {
        const valid = tasks.filter(t => t.startDate && t.dueDate && t.location);
        if (valid.length === 0) return null;

        // Locais (eixo Y) — ordem oficial das OAEs primeiro, depois extras
        const present = Array.from(new Set(valid.map(t => t.location))) as string[];
        const ordered = [
            ...oaeLocations.filter(l => present.includes(l)),
            ...present.filter(l => !oaeLocations.includes(l)).sort((a, b) => a.localeCompare(b)),
        ];
        const rowIndex = new Map(ordered.map((l, i) => [l, i]));

        // Janela de tempo
        const times = valid.flatMap(t => [
            new Date(t.startDate + 'T00:00:00').getTime(),
            new Date(t.dueDate + 'T00:00:00').getTime(),
        ]);
        const minT = Math.min(...times);
        const maxT = Math.max(...times);
        const totalDays = Math.round((maxT - minT) / DAY_MS) + 1;

        const bars = valid.map(t => {
            const startDay = Math.round((new Date(t.startDate + 'T00:00:00').getTime() - minT) / DAY_MS);
            const endDay = Math.round((new Date(t.dueDate + 'T00:00:00').getTime() - minT) / DAY_MS) + 1;
            return {
                task: t,
                team: classifyTeam(t),
                startDay,
                endDay: Math.max(endDay, startDay + 1),
                row: rowIndex.get(t.location) ?? 0,
            };
        });

        // Curva S — conclusão planejada acumulada
        const total = bars.length;
        const sorted = [...bars].sort((a, b) => a.endDay - b.endDay);
        let cum = 0;
        const sCurve = sorted.map(b => {
            cum += 1;
            return { day: b.endDay, frac: cum / total };
        });

        // Equipes presentes (para legenda)
        const teamsPresent = TEAM_ORDER.filter(tk => bars.some(b => b.team === tk));

        return { ordered, rowIndex, minT, totalDays, bars, sCurve, teamsPresent };
    }, [tasks]);

    if (!model) {
        return (
            <div className="h-[400px] flex items-center justify-center text-brand-med-gray italic text-sm">
                Nenhuma atividade com local e datas para gerar a Linha de Balanço.
            </div>
        );
    }

    // Layout
    const GUTTER = 64;     // coluna de rótulos (locais)
    const ROW_H = 44;
    const TOP_PAD = 12;
    const AXIS_H = 36;
    const SKEW = 9;        // inclinação do paralelogramo
    const rows = model.ordered.length;
    const chartH = rows * ROW_H;
    const width = GUTTER + model.totalDays * dayW + 24;
    const height = TOP_PAD + chartH + AXIS_H;

    const xForDay = (d: number) => GUTTER + d * dayW;
    const yForFrac = (f: number) => TOP_PAD + chartH * (1 - f);

    // Ticks de data (semanais)
    const tickStepDays = dayW >= 22 ? 7 : dayW >= 12 ? 7 : 14;
    const ticks: { day: number; label: string }[] = [];
    for (let d = 0; d <= model.totalDays; d += tickStepDays) {
        const date = new Date(model.minT + d * DAY_MS);
        ticks.push({ day: d, label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) });
    }

    const sCurvePoints = model.sCurve.map(p => `${xForDay(p.day)},${yForFrac(p.frac)}`).join(' ');

    return (
        <div className="w-full">
            {/* Controles + legenda */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-3">
                    {model.teamsPresent.map(tk => (
                        <span key={tk} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: TEAM_COLORS[tk] }} />
                            {TEAM_LABELS[tk]}
                        </span>
                    ))}
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
                        <span className="w-4 h-0.5" style={{ backgroundColor: '#e2e8f0' }} />
                        Curva S (avanço acum.)
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setDayW(w => Math.max(6, w - 4))}
                        className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-brand-med-gray hover:text-white text-xs font-black"
                        title="Reduzir zoom"
                    >−</button>
                    <button
                        onClick={() => setDayW(w => Math.min(40, w + 4))}
                        className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-brand-med-gray hover:text-white text-xs font-black"
                        title="Aumentar zoom"
                    >+</button>
                </div>
            </div>

            {/* Diagrama (scroll horizontal) */}
            <div className="overflow-x-auto custom-scrollbar bg-[#0a0f18] rounded-xl border border-white/5">
                <svg width={width} height={height} className="block">
                    {/* Faixas de linha (locais) alternadas */}
                    {model.ordered.map((loc, i) => (
                        <g key={loc}>
                            <rect
                                x={0}
                                y={TOP_PAD + i * ROW_H}
                                width={width}
                                height={ROW_H}
                                fill={i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                            />
                            <text
                                x={8}
                                y={TOP_PAD + i * ROW_H + ROW_H / 2 + 3}
                                fill="#9CA3AF"
                                fontSize={10}
                                fontWeight={700}
                            >
                                {loc}
                            </text>
                            <line
                                x1={GUTTER}
                                y1={TOP_PAD + i * ROW_H}
                                x2={width}
                                y2={TOP_PAD + i * ROW_H}
                                stroke="rgba(255,255,255,0.04)"
                            />
                        </g>
                    ))}

                    {/* Linhas de grade verticais + eixo de datas */}
                    {ticks.map(tk => (
                        <g key={tk.day}>
                            <line
                                x1={xForDay(tk.day)}
                                y1={TOP_PAD}
                                x2={xForDay(tk.day)}
                                y2={TOP_PAD + chartH}
                                stroke="rgba(255,255,255,0.05)"
                            />
                            <text
                                x={xForDay(tk.day)}
                                y={TOP_PAD + chartH + 16}
                                fill="#6B7280"
                                fontSize={9}
                                fontWeight={700}
                                textAnchor="middle"
                            >
                                {tk.label}
                            </text>
                        </g>
                    ))}

                    {/* Paralelogramos das atividades */}
                    {model.bars.map((b, idx) => {
                        const x1 = xForDay(b.startDay);
                        const x2 = xForDay(b.endDay);
                        const yTop = TOP_PAD + b.row * ROW_H + 5;
                        const yBot = TOP_PAD + (b.row + 1) * ROW_H - 5;
                        const color = TEAM_COLORS[b.team];
                        const w = x2 - x1;
                        const points = `${x1 + SKEW},${yTop} ${x2 + SKEW},${yTop} ${x2},${yBot} ${x1},${yBot}`;
                        return (
                            <g key={`${b.task.id}-${idx}`}>
                                <polygon
                                    points={points}
                                    fill={color}
                                    fillOpacity={0.78}
                                    stroke={color}
                                    strokeWidth={1}
                                >
                                    <title>
                                        {`${b.task.title}\nLocal: ${b.task.location}\nEquipe: ${TEAM_LABELS[b.team]}\nInício: ${new Date(b.task.startDate + 'T00:00:00').toLocaleDateString('pt-BR')}\nFim: ${new Date(b.task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                                    </title>
                                </polygon>
                                {w > 42 && (
                                    <text
                                        x={x1 + w / 2 + SKEW / 2}
                                        y={(yTop + yBot) / 2 + 3}
                                        fill="#0a0f18"
                                        fontSize={8}
                                        fontWeight={800}
                                        textAnchor="middle"
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {TEAM_LABELS[b.team].toUpperCase()}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Curva S */}
                    {model.sCurve.length > 1 && (
                        <polyline
                            points={sCurvePoints}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth={2.5}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            opacity={0.9}
                        />
                    )}
                </svg>
            </div>
        </div>
    );
};

export default LineOfBalanceChart;
