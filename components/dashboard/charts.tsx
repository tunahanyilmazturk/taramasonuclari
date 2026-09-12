import React, { memo } from 'react';
import { parseTrDate } from '../../utils/lab';

interface RangeVisualizerProps {
  value: number;
  min: number;
  max: number;
  unit: string;
  isAntiHbs?: boolean;
}

export const RangeVisualizer: React.FC<RangeVisualizerProps> = memo(({ value, min, max, unit: _unit, isAntiHbs }) => {
  const rangeWidth = max - min;
  const padding = rangeWidth * 0.5;
  const plotMin = Math.max(0, min - padding);
  const plotMax = max + padding;
  const totalPlotWidth = plotMax - plotMin;

  const startSafePct = ((min - plotMin) / totalPlotWidth) * 100;
  const widthSafePct = ((max - min) / totalPlotWidth) * 100;

  let valPosPct = ((value - plotMin) / totalPlotWidth) * 100;
  valPosPct = Math.max(0, Math.min(100, valPosPct));

  let pointColor = 'bg-slate-800';

  if (isAntiHbs) {
      if (value < min) pointColor = 'bg-red-500';
      else pointColor = 'bg-green-500';
  } else {
      if (value > max) pointColor = 'bg-red-500';
      else if (value < min) pointColor = 'bg-orange-500';
  }

  const isSafeRange = isAntiHbs ? 'bg-red-200/50' : 'bg-green-200/50';

  return (
    <div className="mt-2 w-full max-w-[180px]">
      <div className="h-1.5 w-full bg-slate-100 rounded-full relative overflow-visible print:bg-slate-200 print:h-1">
        <div
          className={`absolute top-0 bottom-0 rounded-sm print:bg-slate-300 ${isSafeRange}`}
          style={{ left: `${startSafePct}%`, width: `${widthSafePct}%` }}
        />
        {/* Min/Max Markers */}
        <div className="absolute top-2 left-0 w-full flex justify-between text-[8px] text-slate-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <span style={{ marginLeft: `${startSafePct}%`, transform: 'translateX(-50%)' }}>{min}</span>
            <span style={{ marginLeft: `${startSafePct + widthSafePct}%`, transform: 'translateX(-50%)' }}>{max}</span>
        </div>

        <div
          className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10 transition-all duration-500 print:w-2 print:h-2 print:border-0 ${pointColor}`}
          style={{ left: `calc(${valPosPct}% - 5px)` }}
        />
      </div>
    </div>
  );
});
RangeVisualizer.displayName = 'RangeVisualizer';

interface TrendChartProps {
    history: { date: string, value: number }[];
    min: number;
    max: number;
    unit: string;
}

export const TrendChart: React.FC<TrendChartProps> = memo(({ history, min, max, unit: _unit }) => {
    if (history.length < 2) return null;

    const sorted = [...history].sort((a, b) => parseTrDate(a.date) - parseTrDate(b.date));

    const values = sorted.map(h => h.value);
    const dataMin = Math.min(...values, min * 0.9);
    const dataMax = Math.max(...values, max * 1.1);
    const range = dataMax - dataMin || 1;

    const height = 40;
    const width = 200;

    const getY = (val: number) => height - ((val - dataMin) / range) * height;
    const getX = (idx: number) => (idx / (sorted.length - 1)) * width;

    const points = sorted.map((h, i) => `${getX(i)},${getY(h.value)}`).join(' ');

    const yRefMin = Math.max(0, Math.min(height, getY(min)));
    const yRefMax = Math.max(0, Math.min(height, getY(max)));

    return (
        <div className="flex flex-col gap-1 mt-2">
            <div className="relative h-[40px] w-full max-w-[200px] border-b border-l border-slate-200/50">
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                    <rect x="0" y={yRefMax} width={width} height={Math.abs(yRefMin - yRefMax)} fill="currentColor" className="text-green-50 opacity-60" />
                    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 vector-effect-non-scaling-stroke" />
                    {sorted.map((h, i) => {
                        const isAbnormal = h.value < min || h.value > max;
                        return (
                            <circle
                                key={i}
                                cx={getX(i)}
                                cy={getY(h.value)}
                                r="3"
                                className={`${isAbnormal ? 'fill-red-500' : 'fill-blue-500'} stroke-white stroke-1`}
                            />
                        );
                    })}
                </svg>
            </div>
            <div className="flex justify-between text-[8px] text-slate-400 font-mono w-full max-w-[200px]">
                <span>{sorted[0].date}</span>
                <span>{sorted[sorted.length-1].date}</span>
            </div>
        </div>
    );
});
TrendChart.displayName = 'TrendChart';

interface DistributionBarProps {
    high: number;
    low: number;
    normal: number;
    total: number;
}

export const DistributionBar: React.FC<DistributionBarProps> = memo(({ high, low, normal, total }) => {
    if (total === 0) return <div className="h-2 w-full bg-slate-100 rounded-full"></div>;

    const highPct = (high / total) * 100;
    const lowPct = (low / total) * 100;
    const normalPct = (normal / total) * 100;

    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100">
                <div style={{ width: `${lowPct}%` }} className="bg-orange-400 hover:bg-orange-500 transition-colors" title={`Düşük: ${low}`} />
                <div style={{ width: `${normalPct}%` }} className="bg-green-500 hover:bg-green-600 transition-colors" title={`Normal: ${normal}`} />
                <div style={{ width: `${highPct}%` }} className="bg-red-500 hover:bg-red-600 transition-colors" title={`Yüksek: ${high}`} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>Düşük ({low})</span>
                <span>Normal ({normal})</span>
                <span>Yüksek ({high})</span>
            </div>
        </div>
    );
});
DistributionBar.displayName = 'DistributionBar';
