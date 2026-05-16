import * as React from "react";
import { Badge, type BadgeProps } from "~/components/ui/badge";
import { cn } from "~/utils/cn";

export interface ChipProps extends BadgeProps {
  dotColor?: string;
  pulse?: boolean;
}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ children, className, dotColor, pulse = true, ...props }, ref) => (
    <Badge
      ref={ref}
      className={cn("sf-chip", className)}
      size="unstyled"
      variant="unstyled"
      {...props}
    >
      <span
        aria-hidden
        className={cn("sf-chip-dot", !pulse && "animate-none")}
        style={
          dotColor
            ? {
                background: dotColor,
                boxShadow: `0 0 0 3px color-mix(in oklch, ${dotColor} 25%, transparent)`,
              }
            : undefined
        }
      />
      {children}
    </Badge>
  ),
);
Chip.displayName = "Chip";

export { Chip };
