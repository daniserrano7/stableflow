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
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5",
          isWallet ? "font-mono text-2xs text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {glyph && (
          <>
            <span className="shrink-0">{glyph}</span>
            <span aria-hidden className="shrink-0 text-muted-foreground/50">
              ·
            </span>
          </>
        )}
        <span className="min-w-0 truncate">{name}</span>
      </span>
    </span>
  );
}

export { Entity };
