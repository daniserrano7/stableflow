import * as React from "react";
import { cn } from "~/utils/cn";

export interface FlowBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  trend: "inflow" | "outflow" | "net-pos" | "net-neg";
}

const flowFillClasses = {
  inflow:
    "bg-[linear-gradient(90deg,color-mix(in_oklch,var(--inflow)_35%,transparent),var(--inflow))]",
  "net-pos":
    "bg-[linear-gradient(90deg,color-mix(in_oklch,var(--inflow)_35%,transparent),var(--inflow))]",
  outflow:
    "bg-[linear-gradient(90deg,color-mix(in_oklch,var(--outflow)_35%,transparent),var(--outflow))]",
  "net-neg":
    "bg-[linear-gradient(90deg,color-mix(in_oklch,var(--outflow)_35%,transparent),var(--outflow))]",
} satisfies Record<FlowBarProps["trend"], string>;

const FlowBar = React.forwardRef<HTMLDivElement, FlowBarProps>(
  ({ className, trend, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative h-2 overflow-hidden rounded-full bg-surface-2", className)}
      {...props}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 h-full rounded-full transition-[width] duration-slow ease-[var(--ease-out-quart)]",
          flowFillClasses[trend],
        )}
        data-trend={trend}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  ),
);
FlowBar.displayName = "FlowBar";

export { FlowBar };
