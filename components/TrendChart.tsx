'use client';

import { useId, useMemo, useState } from 'react';

export type ChartColor = 'blue' | 'emerald' | 'red' | 'purple' | 'orange';

const COLOR_HEX: Record<ChartColor, string> = {
  blue: '#3b82f6',
  emerald: '#10b981',
  red: '#ef4444',
  purple: '#a855f7',
  orange: '#f97316',
};

interface ChartSeries {
  name: string;
  color: ChartColor;
  points: { date: string; value: number }[];
}

interface TrendChartProps {
  series: ChartSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
}

const WIDTH = 800;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

const defaultValueFormatter = (v: number) => v.toLocaleString('pt-BR');
const defaultDateFormatter = (d: string) => {
  const date = new Date(`${d}T00:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export default function TrendChart({
  series,
  height = 240,
  valueFormatter = defaultValueFormatter,
  dateFormatter = defaultDateFormatter,
}: TrendChartProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const pointCount = series[0]?.points.length ?? 0;
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const maxValue = Math.max(1, ...allValues);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + (pointCount <= 1 ? plotWidth / 2 : (i / (pointCount - 1)) * plotWidth);
  const yFor = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  const linePaths = useMemo(
    () =>
      series.map((s) => {
        const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`).join(' ');
        const area = `${d} L ${xFor(s.points.length - 1)} ${PAD_TOP + plotHeight} L ${xFor(0)} ${PAD_TOP + plotHeight} Z`;
        return { name: s.name, color: s.color, line: d, area };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, maxValue, plotWidth, plotHeight]
  );

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  if (pointCount === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-zinc-500" style={{ height }}>
        Sem dados no período.
      </div>
    );
  }

  return (
    <div className="w-full">
      {series.length > 1 && (
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[s.color] }} />
              {s.name}
            </div>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.color} id={`${gradientId}-${s.color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_HEX[s.color]} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLOR_HEX[s.color]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Gridlines */}
        {gridLines.map((g) => {
          const y = PAD_TOP + plotHeight * (1 - g);
          return (
            <g key={g}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="#27272a" strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" className="fill-zinc-600" fontSize={10}>
                {valueFormatter(Math.round(maxValue * g))}
              </text>
            </g>
          );
        })}

        {/* Areas + Lines */}
        {linePaths.map((p) => (
          <g key={p.name}>
            <path d={p.area} fill={`url(#${gradientId}-${p.color})`} stroke="none" />
            <path d={p.line} fill="none" stroke={COLOR_HEX[p.color]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}

        {/* End markers + direct labels */}
        {series.map((s) => {
          const last = s.points[s.points.length - 1];
          const x = xFor(s.points.length - 1);
          const y = yFor(last.value);
          return (
            <g key={`${s.name}-end`}>
              <circle cx={x} cy={y} r={5} fill={COLOR_HEX[s.color]} stroke="#18181b" strokeWidth={2} />
              <text x={Math.min(x, WIDTH - PAD_RIGHT - 4)} y={y - 10} textAnchor="end" className="fill-white font-semibold" fontSize={11}>
                {valueFormatter(last.value)}
              </text>
            </g>
          );
        })}

        {/* X axis labels: first, middle, last */}
        {[0, Math.floor((pointCount - 1) / 2), pointCount - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map((i) => (
            <text key={i} x={xFor(i)} y={height - 6} textAnchor="middle" className="fill-zinc-600" fontSize={10}>
              {dateFormatter(series[0].points[i].date)}
            </text>
          ))}

        {/* Hover crosshair */}
        {hoverIndex !== null && (
          <>
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotHeight}
              stroke="#3f3f46"
              strokeWidth={1}
            />
            {series.map((s) => (
              <circle
                key={`${s.name}-hover`}
                cx={xFor(hoverIndex)}
                cy={yFor(s.points[hoverIndex].value)}
                r={5}
                fill={COLOR_HEX[s.color]}
                stroke="#18181b"
                strokeWidth={2}
              />
            ))}
          </>
        )}

        {/* Hit layer */}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onMouseMove={(e) => {
            const svg = e.currentTarget.ownerSVGElement;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
            const ratio = Math.min(1, Math.max(0, (relX - PAD_LEFT) / plotWidth));
            const idx = Math.round(ratio * (pointCount - 1));
            setHoverIndex(idx);
          }}
        />
      </svg>

      {hoverIndex !== null && (
        <div className="mt-2 inline-flex flex-col gap-1 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-xs">
          <span className="text-zinc-500">{dateFormatter(series[0].points[hoverIndex].date)}</span>
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-2">
              <span className="w-2 h-0.5 rounded" style={{ backgroundColor: COLOR_HEX[s.color] }} />
              <span className="text-zinc-400">{s.name}:</span>
              <span className="text-white font-semibold">{valueFormatter(s.points[hoverIndex].value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
