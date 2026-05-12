// AnomalyItem — a single row in the live anomaly / whale-alert feed.

import * as React from "react";
import { cn } from "../lib/utils";

export type AnomalyKind = "whale" | "spike" | "drain";

export interface AnomalyItemProps extends React.HTMLAttributes<HTMLDivElement> {
  kind: AnomalyKind;
  verb: string;
  time: string;
  meta?: React.ReactNode;
}

export const AnomalyItem = React.forwardRef<HTMLDivElement, AnomalyItemProps>(
  ({ className, kind, verb, time, meta, children, ...props }, ref) => (
    <div ref={ref} className={cn("sf-anomaly-item", className)} {...props}>
      <div className="flex items-center gap-2 mb-1.5">
        <span data-kind={kind} className="sf-anomaly-tag">
          {verb}
        </span>
        <span className="ml-auto font-mono text-2xs text-muted-foreground">{time}</span>
      </div>
      <div className="text-sm text-foreground leading-snug">{children}</div>
      {meta && (
        <div className="mt-1.5 font-mono text-2xs text-muted-foreground flex gap-2.5">{meta}</div>
      )}
    </div>
  ),
);
AnomalyItem.displayName = "AnomalyItem";
