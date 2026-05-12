// Entity cell — glyph avatar + name (or shortened address for wallets).

import * as React from "react";
import { cn } from "../lib/utils";
import type { Category } from "../tokens";

export interface EntityProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  glyph?: React.ReactNode;
  color?: string;
  category?: Category;
  isWallet?: boolean;
}

export const Entity = React.forwardRef<HTMLSpanElement, EntityProps>(
  ({ className, name, glyph, color, category, isWallet, ...props }, ref) => (
    <span ref={ref} className={cn("sf-entity", className)} {...props}>
      <span
        className="sf-entity-glyph"
        style={{ background: color ?? `var(--cat-${category ?? "wallet"})` }}
        aria-hidden
      >
        {glyph}
      </span>
      <span className={isWallet ? "sf-entity-addr" : "sf-entity-name"}>{name}</span>
    </span>
  ),
);
Entity.displayName = "Entity";
