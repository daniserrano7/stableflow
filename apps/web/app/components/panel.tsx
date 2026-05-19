import * as React from "react";
import { Card, CardContent, CardTitle } from "~/components/ui/card";
import { cn } from "~/utils/cn";

export interface PanelProps extends React.ComponentPropsWithoutRef<typeof Card> {
  noBlur?: boolean;
}

const panelGlassClasses =
  "[backdrop-filter:var(--blur-glass)] [-webkit-backdrop-filter:var(--blur-glass)]";

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, noBlur, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-lg border-border bg-glass shadow-sm",
        !noBlur && panelGlassClasses,
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

const PanelHead = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between border-border border-b px-3.5 py-3",
        className,
      )}
      {...props}
    />
  ),
);
PanelHead.displayName = "PanelHead";

export interface PanelTitleProps extends React.ComponentPropsWithoutRef<typeof CardTitle> {
  live?: boolean;
}

const PanelTitle = React.forwardRef<HTMLDivElement, PanelTitleProps>(
  ({ children, className, live, ...props }, ref) => (
    <CardTitle
      ref={ref}
      className={cn(
        "flex items-center gap-2 font-mono text-muted-foreground text-sm uppercase tracking-[0.06em]",
        className,
      )}
      {...props}
    >
      {live && (
        <span
          aria-hidden
          className="h-[7px] w-[7px] rounded-full bg-inflow shadow-[0_0_0_3px_var(--inflow-soft)] animate-[sf-pulse_1.6s_ease-in-out_infinite] motion-reduce:animate-none"
        />
      )}
      {children}
    </CardTitle>
  ),
);
PanelTitle.displayName = "PanelTitle";

const PanelActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex gap-1.5", className)} {...props} />
  ),
);
PanelActions.displayName = "PanelActions";

const PanelBody = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof CardContent>>(
  ({ className, ...props }, ref) => (
    <CardContent ref={ref} className={cn("p-4", className)} {...props} />
  ),
);
PanelBody.displayName = "PanelBody";

export { Panel, PanelActions, PanelBody, PanelHead, PanelTitle };
