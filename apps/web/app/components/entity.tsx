import * as React from "react";
import type { Category } from "~/styles/tokens";
import { cn } from "~/utils/cn";

export interface EntityProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  glyph?: React.ReactNode;
  color?: string;
  category?: Category;
  isWallet?: boolean;
}

const Entity = React.forwardRef<HTMLSpanElement, EntityProps>(
  ({ category, className, color, glyph, isWallet, name, ...props }, ref) => (
    <span ref={ref} className={cn("sf-entity", className)} {...props}>
      <span
        aria-hidden
        className="sf-entity-glyph"
        style={{ background: color ?? `var(--cat-${category ?? "wallet"})` }}
      >
        {glyph}
      </span>
      <span className={isWallet ? "sf-entity-addr" : "sf-entity-name"}>{name}</span>
    </span>
  ),
);
Entity.displayName = "Entity";

export { Entity };
