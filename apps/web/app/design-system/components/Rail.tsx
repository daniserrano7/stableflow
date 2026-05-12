// Rail — left icon-only nav rail (Linear-style). Items show a tooltip on hover.

import * as React from "react";
import { cn } from "../lib/utils";

export interface RailProps extends React.HTMLAttributes<HTMLElement> {}

export const Rail = React.forwardRef<HTMLElement, RailProps>(
  ({ className, children, ...props }, ref) => (
    <aside ref={ref} className={cn("sf-rail", className)} {...props}>
      {children}
    </aside>
  ),
);
Rail.displayName = "Rail";

export interface RailItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  badge?: boolean;
}

export const RailItem = React.forwardRef<HTMLButtonElement, RailItemProps>(
  ({ className, active, label, badge, children, ...props }, ref) => (
    <button
      ref={ref}
      data-state={active ? "active" : undefined}
      aria-label={label}
      className={cn("sf-rail-item group", className)}
      {...props}
    >
      {children}
      {badge && (
        <span className="absolute top-[5px] right-[5px] w-1.5 h-1.5 rounded-full bg-anomaly ring-2 ring-background" />
      )}
      <span className="absolute left-11 top-1/2 -translate-y-1/2 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition pointer-events-none whitespace-nowrap rounded-md border border-border bg-surface-3 px-2.5 py-1 text-2xs uppercase tracking-wider font-mono text-foreground z-50 shadow-sm">
        {label}
      </span>
    </button>
  ),
);
RailItem.displayName = "RailItem";
