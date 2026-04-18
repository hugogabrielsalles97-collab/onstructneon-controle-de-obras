import React, { useMemo } from 'react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { Restriction, RestrictionType, RestrictionStatus, RestrictionPriority } from '../types';

interface RestrictionsRadarChartProps {
    restrictions: Restriction[];
}

const RestrictionsRadarChart: React.FC<RestrictionsRadarChartProps> = ({ restrictions }) => {
    // Generate data containing both weighted score and raw count per Restriction Type
    const data = useMemo(() => {
        return Object.values(RestrictionType).map(type => {
            const relevantRestrictions = restrictions.filter(r => r.type === type && r.status !== RestrictionStatus.Resolved);

            // Weighted score calculation
            const score = relevantRestrictions.reduce((acc, curr) => {
                let weight = 0;
                switch (curr.priority) {
                    case RestrictionPriority.Critical: weight = 4; break; // Increased weight for critical
                    case RestrictionPriority.High: weight = 2.5; break;
                    case RestrictionPriority.Medium: weight = 1; break;
                    case RestrictionPriority.Low: weight = 0.5; break;
                    default: weight = 0;
                }
                return acc + weight;
            }, 0);

            return {
                subject: type,
                score: score,
                count: relevantRestrictions.length,
            };
        });
    }, [restrictions]);

    // Custom Tooltip Component for better styling
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#0a0f18]/95 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl">
                    <p className="text-white font-black uppercase text-xs tracking-widest mb-2">{label}</p>
                    <div className="space-y-1">
                        <p className="text-brand-accent text-sm font-bold flex items-center justify-between gap-4">
                            <span>Impacto Ponderado:</span>
                            <span>{payload[0].value.toFixed(1)}</span>
                        </p>
                        <p className="text-gray-400 text-xs flex items-center justify-between gap-4">
                            <span>Quantidade:</span>
                            <span>{payload[0].payload.count}</span>
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[400px] bg-[#111827] rounded-2xl border border-white/5 p-6 relative overflow-hidden group hover:border-brand-accent/30 transition-all duration-500">
            {/* Background Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-accent/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-brand-accent/10 transition-all duration-500"></div>

            <div className="flex justify-between items-start relative z-10 mb-2">
                <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Radar de Restrições</h3>
                    <p className="text-xs text-brand-med-gray mt-1">Impacto ponderado por categoria</p>
                </div>
                {/* Legend/Info Icon could go here */}
            </div>

            <div className="w-full h-full pb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="#374151" strokeDasharray="3 3" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 700 }}
                        />
                        <PolarRadiusAxis
                            angle={30}
                            domain={[0, 'auto']}
                            tick={false}
                            axisLine={false}
                        />
                        <Radar
                            name="Impacto"
                            dataKey="score"
                            stroke="#e35a10"
                            strokeWidth={3}
                            fill="#e35a10"
                            fillOpacity={0.3}
                            className="drop-shadow-[0_0_10px_rgba(227,90,16,0.3)]"
                        />
                        <Tooltip content={<CustomTooltip />} cursor={false} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default RestrictionsRadarChart;
