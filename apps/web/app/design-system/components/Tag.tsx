// Tag — small uppercase pill for protocol category, status, etc.

import * as React from "react";
import { cn } from "../lib/utils";
import type { Category } from "../tokens";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  category?: Category;
}

const LABEL: Record<Category, string> = {
  dex: "DEX",
  lending: "Lending",
  bridge: "Bridge",
  cex: "CEX",
  mint: "Mint",
  wallet: "Wallet",
};

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  ({ className, category, children, ...props }, ref) => (
    <span ref={ref} data-cat={category} className={cn("sf-tag", className)} {...props}>
      {children ?? (category ? LABEL[category] : null)}
    </span>
  ),
);
Tag.displayName = "Tag";
