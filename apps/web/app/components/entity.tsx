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
    <span ref={ref} className={cn("inline-flex items-center gap-2", className)} {...props}>
      <span
        aria-hidden
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] font-mono font-semibold text-[9px] text-[oklch(0.13_0.012_254)]"
        style={{ background: color ?? `var(--cat-${category ?? "wallet"})` }}
      >
        {glyph}
      </span>
      <span className={isWallet ? "font-mono text-2xs text-muted-foreground" : "font-medium text-foreground"}>
        {name}
      </span>
    </span>
  ),
);
Entity.displayName = "Entity";

export { Entity };
