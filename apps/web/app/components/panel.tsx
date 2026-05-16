import * as React from "react";
import { Card, CardContent, CardTitle } from "~/components/ui/card";
import { cn } from "~/utils/cn";

export interface PanelProps extends React.ComponentPropsWithoutRef<typeof Card> {
  noBlur?: boolean;
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, noBlur, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn("sf-panel", noBlur && "!backdrop-filter-none", className)}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

const PanelHead = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("sf-panel-head", className)} {...props} />
  ),
);
PanelHead.displayName = "PanelHead";

export interface PanelTitleProps extends React.ComponentPropsWithoutRef<typeof CardTitle> {
  live?: boolean;
}

const PanelTitle = React.forwardRef<HTMLDivElement, PanelTitleProps>(
  ({ children, className, live, ...props }, ref) => (
    <CardTitle ref={ref} className={cn("sf-panel-title", className)} {...props}>
      {live && <span aria-hidden className="sf-live-dot" />}
      {children}
    </CardTitle>
  ),
);
PanelTitle.displayName = "PanelTitle";

const PanelActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("sf-panel-actions", className)} {...props} />
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
