// KPI card — number + label + delta + sparkline. Used in the top stats strip.

import * as React from "react";
import { cn } from "../lib/utils";

export interface KPIProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: { value: string; trend: "up" | "down" };
  spark?: React.ReactNode;
}

export const KPI = React.forwardRef<HTMLDivElement, KPIProps>(
  ({ className, label, value, unit, delta, spark, ...props }, ref) => (
    <div ref={ref} className={cn("sf-kpi", className)} {...props}>
      <div className="sf-kpi-label">{label}</div>
      <div className="sf-kpi-value">
        {value}
        {unit && <span className="sf-kpi-unit">{unit}</span>}
      </div>
      {delta && (
        <div className="sf-kpi-delta" data-trend={delta.trend}>
          {delta.trend === "up" ? "▲" : "▼"} {delta.value}
        </div>
      )}
      {spark && <div className="sf-kpi-spark">{spark}</div>}
    </div>
  ),
);
KPI.displayName = "KPI";

// Lightweight inline sparkline — drop in <Sparkline data={[…]} />
export function Sparkline({
  data,
  color = "var(--accent)",
  width = 84,
  height = 36,
  strokeWidth = 1.4,
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
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * height] as const);
  const lastPoint = pts.at(-1);

  if (!lastPoint) return null;

  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const dArea = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sparkline trend"
    >
      <title>Sparkline trend</title>
      <path d={dArea} fill={color} opacity="0.18" />
      <path
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2" fill={color} />
    </svg>
  );
}
