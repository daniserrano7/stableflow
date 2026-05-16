import * as React from "react";
import { cn } from "~/utils/cn";

export interface FlowBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  trend: "inflow" | "outflow" | "net-pos" | "net-neg";
}

const FlowBar = React.forwardRef<HTMLDivElement, FlowBarProps>(
  ({ className, trend, value, ...props }, ref) => (
    <div ref={ref} className={cn("sf-flowbar", className)} {...props}>
      <div
        className="fill"
        data-trend={trend}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  ),
);
FlowBar.displayName = "FlowBar";

export { FlowBar };
