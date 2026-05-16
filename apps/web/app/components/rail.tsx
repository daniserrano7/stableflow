import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/utils/cn";

export interface RailProps extends React.HTMLAttributes<HTMLElement> {}

const Rail = React.forwardRef<HTMLElement, RailProps>(({ children, className, ...props }, ref) => (
  <aside ref={ref} className={cn("sf-rail", className)} {...props}>
    {children}
  </aside>
));
Rail.displayName = "Rail";

export interface RailItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  badge?: boolean;
  label: string;
}

const RailItem = React.forwardRef<HTMLButtonElement, RailItemProps>(
  ({ active, badge, children, className, label, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          aria-label={label}
          className={cn("sf-rail-item", className)}
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
  ),
);
RailItem.displayName = "RailItem";

export { Rail, RailItem };
