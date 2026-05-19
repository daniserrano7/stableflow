import type * as React from "react";
import { Card, CardContent, CardTitle } from "~/components/ui/card";
import { cn } from "~/utils/cn";

export interface PanelProps extends React.ComponentPropsWithoutRef<typeof Card> {
  noBlur?: boolean;
}

const panelGlassClasses =
  "[backdrop-filter:var(--blur-glass)] [-webkit-backdrop-filter:var(--blur-glass)]";

function Panel({ className, noBlur, ...props }: PanelProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-lg border-border bg-glass shadow-sm",
        !noBlur && panelGlassClasses,
        className,
      )}
      {...props}
    />
  );
}

function PanelHead({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-border border-b px-3.5 py-3",
        className,
      )}
      {...props}
    />
  );
}

export interface PanelTitleProps extends React.ComponentPropsWithoutRef<typeof CardTitle> {
  live?: boolean;
}

function PanelTitle({ children, className, live, ...props }: PanelTitleProps) {
  return (
    <CardTitle
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
  );
}

function PanelActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-1.5", className)} {...props} />;
}

function PanelBody({ className, ...props }: React.ComponentPropsWithoutRef<typeof CardContent>) {
  return <CardContent className={cn("p-4", className)} {...props} />;
}

export { Panel, PanelActions, PanelBody, PanelHead, PanelTitle };
