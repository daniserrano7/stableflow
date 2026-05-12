// Chip — used for network, asset, status pills in top bar.

import * as React from "react";
import { cn } from "../lib/utils";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  pulse?: boolean;
  dotColor?: string;
}

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, pulse = true, dotColor, children, ...props }, ref) => (
    <span ref={ref} className={cn("sf-chip", className)} {...props}>
      <span
        className={cn("sf-chip-dot", !pulse && "animate-none")}
        style={
          dotColor
            ? {
                background: dotColor,
                boxShadow: `0 0 0 3px color-mix(in oklch, ${dotColor} 25%, transparent)`,
              }
            : undefined
        }
        aria-hidden
      />
      {children}
    </span>
  ),
);
Chip.displayName = "Chip";
