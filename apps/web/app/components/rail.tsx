import type * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/utils/cn";

export interface RailProps extends React.HTMLAttributes<HTMLElement> {}

function Rail({ children, className, ...props }: RailProps) {
  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-[var(--size-rail)] flex-col items-center border-border border-r bg-glass py-3.5 [backdrop-filter:var(--blur-glass)] [-webkit-backdrop-filter:var(--blur-glass)]",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export interface RailItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  badge?: boolean;
  label: string;
}

function RailItem({ active, badge, children, className, label, ...props }: RailItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            "relative inline-flex size-9 cursor-pointer items-center justify-center rounded-[9px] border-0 bg-transparent text-muted-foreground transition-[color,background] duration-fast hover:bg-surface-2 hover:text-foreground data-[state=active]:bg-surface-3 data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_var(--border)] data-[state=active]:before:absolute data-[state=active]:before:top-1/2 data-[state=active]:before:-left-2.5 data-[state=active]:before:h-3.5 data-[state=active]:before:w-[3px] data-[state=active]:before:-translate-y-1/2 data-[state=active]:before:rounded-[2px] data-[state=active]:before:bg-accent data-[state=active]:before:shadow-[0_0_12px_var(--accent)] data-[state=active]:before:content-['']",
            className,
          )}
          data-state={active ? "active" : undefined}
          {...props}
        >
          {children}
          {badge && (
            <span className="absolute top-[5px] right-[5px] h-1.5 w-1.5 rounded-full bg-anomaly ring-2 ring-background" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export { Rail, RailItem };
