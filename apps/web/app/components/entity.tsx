import type * as React from "react";
import { getVisualIdentity } from "~/config/visuals";
import type { Category } from "~/styles/tokens";
import { getAddressAvatarBackground } from "~/utils/address-avatar";
import { cn } from "~/utils/cn";
import { VisualMark } from "./visual-mark";

export interface EntityProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  /** Wallet address; gives unlabeled wallets a recognisable avatar instead of a generic mark. */
  address?: string;
  glyph?: React.ReactNode;
  color?: string;
  category?: Category;
  entityId?: string | null;
  isWallet?: boolean;
}

function Entity({
  address,
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
  const walletAvatar = isWallet && address ? getAddressAvatarBackground(address) : undefined;

  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      {/* Wallets are round, entities are rounded squares: the shape says which is which. */}
      <VisualMark
        className={cn(
          "size-5 font-mono font-semibold text-[9px] text-[oklch(0.13_0.012_254)]",
          walletAvatar ? "rounded-full" : "rounded-[5px]",
        )}
        fallback={walletAvatar ? null : glyph}
        imageName={visual?.name}
        imageSize={20}
        imageUrl={visual?.imageUrl}
        style={{ background: walletAvatar ?? color ?? `var(--cat-${category ?? "wallet"})` }}
      />
      <span
        className={cn(
          "min-w-0 truncate",
          isWallet ? "font-mono text-xs text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {name}
      </span>
    </span>
  );
}

export { Entity };
