// Amount — formats and colors a number by magnitude (small/large/whale)
// or by trend (up/down). Used in tables and lists.

import * as React from "react";
import { cn, fmtUSDC } from "../lib/utils";
import { classifyAmount } from "../tokens";

export interface AmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  unit?: string;
  trend?: "up" | "down";
  /** Override automatic magnitude classification */
  magnitude?: "small" | "large" | "whale";
}

export const Amount = React.forwardRef<HTMLSpanElement, AmountProps>(
  ({ className, value, unit = "USDC", trend, magnitude, ...props }, ref) => {
    const mag = magnitude ?? classifyAmount(Math.abs(value));
    return (
      <span
        ref={ref}
        data-magnitude={mag}
        data-trend={trend}
        className={cn("sf-amount", className)}
        {...props}
      >
        {fmtUSDC(value)}
        {unit && <span className="sf-amount-unit">{unit}</span>}
      </span>
    );
  },
);
Amount.displayName = "Amount";
