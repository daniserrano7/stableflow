import { Badge, type BadgeProps } from "~/components/ui/badge";
import { cn } from "~/utils/cn";

export interface ChipProps extends BadgeProps {
  dotColor?: string;
  pulse?: boolean;
}

const chipClasses =
  "inline-flex items-center gap-[7px] rounded-full border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-muted-foreground text-xs tracking-[0.02em]";

function Chip({ children, className, dotColor, pulse = true, ...props }: ChipProps) {
  return (
    <Badge className={cn(chipClasses, className)} size="unstyled" variant="unstyled" {...props}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full bg-inflow shadow-[0_0_0_3px_var(--inflow-soft)]",
          pulse && "animate-pulse-soft",
        )}
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
  );
}

export { Chip };
