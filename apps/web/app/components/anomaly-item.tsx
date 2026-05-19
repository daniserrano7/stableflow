import * as React from "react";
import { cn } from "~/utils/cn";

export type AnomalyKind = "whale" | "spike" | "drain";

export interface AnomalyItemProps extends React.HTMLAttributes<HTMLDivElement> {
  kind: AnomalyKind;
  verb: string;
  time: string;
  meta?: React.ReactNode;
}

const anomalyKindClasses = {
  drain: "border-outflow/40 bg-outflow-soft text-outflow",
  spike: "border-accent/40 bg-accent-soft text-accent",
  whale: "border-whale/40 bg-whale-soft text-whale",
} satisfies Record<AnomalyKind, string>;

const AnomalyItem = React.forwardRef<HTMLDivElement, AnomalyItemProps>(
  ({ children, className, kind, meta, time, verb, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("border-border border-b px-3.5 py-3 animate-slide-in", className)}
      {...props}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]",
            anomalyKindClasses[kind],
          )}
          data-kind={kind}
        >
          {verb}
        </span>
        <span className="ml-auto font-mono text-2xs text-muted-foreground">{time}</span>
      </div>
      <div className="text-sm leading-snug text-foreground">{children}</div>
      {meta && (
        <div className="mt-1.5 flex gap-2.5 font-mono text-2xs text-muted-foreground">{meta}</div>
      )}
    </div>
  ),
);
AnomalyItem.displayName = "AnomalyItem";

export { AnomalyItem };
