import type * as React from "react";
import { classifyAmount } from "~/styles/tokens";
import { cn } from "~/utils/cn";
import { fmtUSDC } from "~/utils/format";

export interface AmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  unit?: string;
  trend?: "up" | "down";
  magnitude?: "small" | "large" | "whale";
}

// Size tokens, so ≥ 10K and whale transfers stand out from routine ones at a glance.
const magnitudeClasses = {
  large: "text-magnitude-large",
  small: "",
  whale: "text-whale",
} satisfies Record<NonNullable<AmountProps["magnitude"]>, string>;

const trendClasses = {
  down: "text-outflow",
  up: "text-inflow",
} satisfies Record<NonNullable<AmountProps["trend"]>, string>;

function Amount({ className, magnitude, trend, unit = "USDC", value, ...props }: AmountProps) {
  const mag = magnitude ?? classifyAmount(Math.abs(value));

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono font-medium tabular-nums",
        magnitudeClasses[mag],
        trend && trendClasses[trend],
        className,
      )}
      data-magnitude={mag}
      data-trend={trend}
      {...props}
    >
      {fmtUSDC(value)}
      {unit && <span className="text-2xs text-muted-foreground">{unit}</span>}
    </span>
  );
}

export { Amount };
