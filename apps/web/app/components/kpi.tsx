import type * as React from 'react';
import { cn } from '~/utils/cn';

export interface KPIProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: { value: string; trend: 'down' | 'flat' | 'up' };
  spark?: React.ReactNode;
}

const deltaTrendClasses = {
  down: 'text-outflow',
  flat: 'text-muted-foreground',
  up: 'text-inflow',
} satisfies Record<NonNullable<KPIProps['delta']>['trend'], string>;

function KPI({
  className,
  delta,
  label,
  spark,
  unit,
  value,
  ...props
}: KPIProps) {
  return (
    <div
      className={cn(
        'relative w-full grid grid-cols-[auto_120px] gap-y-8 justify-between gap-1.5 overflow-hidden rounded-lg border border-border bg-glass px-4 py-3.5 [backdrop-filter:var(--blur-glass)] [-webkit-backdrop-filter:var(--blur-glass)]',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap col-span-2 items-center justify-between gap-1.5 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </div>
      <div className="flex flex-col items-start">
        <div className="mt-1.5 flex items-baseline gap-1.5 font-medium text-2xl tabular-nums tracking-normal">
          {value}
          {unit && (
            <span className="font-normal text-muted-foreground text-sm">
              {unit}
            </span>
          )}
        </div>
        {delta && (
          <div
            className={cn(
              'mt-1 flex flex-wrap items-center gap-1 font-mono text-xs',
              deltaTrendClasses[delta.trend],
            )}
            data-trend={delta.trend}
          >
            {delta.trend === 'up' ? '▲' : delta.trend === 'down' ? '▼' : '→'}{' '}
            {delta.value}
          </div>
        )}
      </div>
      {spark && (
        <div className="pointer-events-none flex items-end">{spark}</div>
      )}
    </div>
  );
}

function Sparkline({
  color = 'var(--accent)',
  data,
  height = 56,
  strokeWidth = 1.4,
  width = 120,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map(
    (v, i) => [i * step, height - ((v - min) / range) * height] as const,
  );
  const lastPoint = pts.at(-1);

  if (!lastPoint) return null;

  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');
  const dArea = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      aria-label="Sparkline trend"
      height={height}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <title>Sparkline trend</title>
      <path d={dArea} fill={color} opacity="0.18" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} fill={color} r="2" />
    </svg>
  );
}

export { KPI, Sparkline };
