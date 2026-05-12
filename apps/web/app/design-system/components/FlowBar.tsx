// FlowBar — horizontal magnitude bar used in Top Movers, anomaly meters, etc.

import * as React from "react";
import { cn } from "../lib/utils";

export interface FlowBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0..100 */
  value: number;
  trend: "inflow" | "outflow" | "net-pos" | "net-neg";
}

export const FlowBar = React.forwardRef<HTMLDivElement, FlowBarProps>(
  ({ className, value, trend, ...props }, ref) => (
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
