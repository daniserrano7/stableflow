import * as React from 'react';
import { cn } from '~/utils/cn';

export interface KPIProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: { value: string; trend: 'down' | 'flat' | 'up' };
  spark?: React.ReactNode;
}

const KPI = React.forwardRef<HTMLDivElement, KPIProps>(
  ({ className, delta, label, spark, unit, value, ...props }, ref) => (
    <div ref={ref} className={cn('sf-kpi', className)} {...props}>
      <div>
        <div className="sf-kpi-label">{label}</div>
        <div className="sf-kpi-value">
          {value}
          {unit && <span className="sf-kpi-unit">{unit}</span>}
        </div>
        {delta && (
          <div className="sf-kpi-delta" data-trend={delta.trend}>
            {delta.trend === 'up' ? '▲' : delta.trend === 'down' ? '▼' : '→'}{' '}
            {delta.value}
          </div>
        )}
      </div>
      {spark && <div className="sf-kpi-spark">{spark}</div>}
    </div>
  ),
);
KPI.displayName = 'KPI';

function Sparkline({
  color = 'var(--accent)',
  data,
  height = 36,
  strokeWidth = 1.4,
  width = 84,
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
