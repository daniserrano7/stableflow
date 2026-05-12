// Panel — the canonical glassy card used everywhere (graph, table, anomaly feed, …).

import * as React from "react";
import { cn } from "../lib/utils";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  noBlur?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, noBlur, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("sf-panel", noBlur && "!backdrop-filter-none", className)}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

export interface PanelHeadProps extends React.HTMLAttributes<HTMLDivElement> {}
export const PanelHead = React.forwardRef<HTMLDivElement, PanelHeadProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("sf-panel-head", className)} {...props} />
  ),
);
PanelHead.displayName = "PanelHead";

export interface PanelTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  live?: boolean;
}
export const PanelTitle = React.forwardRef<HTMLDivElement, PanelTitleProps>(
  ({ className, live, children, ...props }, ref) => (
    <div ref={ref} className={cn("sf-panel-title", className)} {...props}>
      {live && <span className="sf-live-dot" aria-hidden />}
      {children}
    </div>
  ),
);
PanelTitle.displayName = "PanelTitle";

export const PanelActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("sf-panel-actions", className)} {...props} />
  ),
);
PanelActions.displayName = "PanelActions";

export const PanelBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-4", className)} {...props} />,
);
PanelBody.displayName = "PanelBody";
