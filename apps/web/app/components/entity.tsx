import type * as React from "react";
import { getVisualIdentity } from "~/config/visuals";
import type { Category } from "~/styles/tokens";
import { cn } from "~/utils/cn";
import { VisualMark } from "./visual-mark";

export interface EntityProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  glyph?: React.ReactNode;
  color?: string;
  category?: Category;
  entityId?: string | null;
  isWallet?: boolean;
}

function Entity({
  category,
  className,
  color,
  entityId,
  glyph,
  isWallet,
  name,
  ...props
}: EntityProps) {
  const visual = entityId ? getVisualIdentity("entity", entityId) : undefined;

  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      <VisualMark
        className="size-5 rounded-[5px] font-mono font-semibold text-[9px] text-[oklch(0.13_0.012_254)]"
        fallback={glyph}
        imageName={visual?.name}
        imageUrl={visual?.imageUrl}
        style={{ background: color ?? `var(--cat-${category ?? "wallet"})` }}
      />
      <span
        className={
          isWallet ? "font-mono text-2xs text-muted-foreground" : "font-medium text-foreground"
        }
      >
        {name}
      </span>
    </span>
  );
}

export { Entity };
