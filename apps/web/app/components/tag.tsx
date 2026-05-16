import * as React from "react";
import { Badge, type BadgeProps } from "~/components/ui/badge";
import type { Category } from "~/styles/tokens";
import { cn } from "~/utils/cn";

export interface TagProps extends BadgeProps {
  category?: Category;
}

const label: Record<Category, string> = {
  bridge: "Bridge",
  cex: "CEX",
  dex: "DEX",
  lending: "Lending",
  mint: "Mint",
  wallet: "Wallet",
};

const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  ({ category, children, className, ...props }, ref) => (
    <Badge
      ref={ref}
      className={cn("sf-tag", className)}
      data-cat={category}
      size="unstyled"
      variant="unstyled"
      {...props}
    >
      {children ?? (category ? label[category] : null)}
    </Badge>
  ),
);
Tag.displayName = "Tag";

export { Tag };
