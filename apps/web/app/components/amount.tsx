import * as React from "react";
import { classifyAmount } from "~/styles/tokens";
import { cn } from "~/utils/cn";
import { fmtUSDC } from "~/utils/format";

export interface AmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  unit?: string;
  trend?: "up" | "down";
  magnitude?: "small" | "large" | "whale";
}

const Amount = React.forwardRef<HTMLSpanElement, AmountProps>(
  ({ className, magnitude, trend, unit = "USDC", value, ...props }, ref) => {
    const mag = magnitude ?? classifyAmount(Math.abs(value));

    return (
      <span
        ref={ref}
        className={cn("sf-amount", className)}
        data-magnitude={mag}
        data-trend={trend}
        {...props}
      >
        {fmtUSDC(value)}
        {unit && <span className="sf-amount-unit">{unit}</span>}
      </span>
    );
  },
);
Amount.displayName = "Amount";

export { Amount };
