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

const tagCategoryClasses: Record<Category, string> = {
  bridge: "border-cat-bridge/35 bg-cat-bridge-soft text-cat-bridge",
  cex: "border-cat-cex/35 bg-cat-cex-soft text-cat-cex",
  dex: "border-cat-dex/35 bg-cat-dex-soft text-cat-dex",
  lending: "border-cat-lending/35 bg-cat-lending-soft text-cat-lending",
  mint: "border-cat-mint/35 bg-cat-mint-soft text-cat-mint",
  wallet: "text-cat-wallet",
};

function Tag({ category, children, className, ...props }: TagProps) {
  return (
    <Badge
      className={cn(
        "rounded-full border border-border bg-surface-2 px-[7px] py-[3px] font-mono text-[9px] text-muted-foreground uppercase tracking-[0.04em]",
        category && tagCategoryClasses[category],
        className,
      )}
      data-cat={category}
      size="unstyled"
      variant="unstyled"
      {...props}
    >
      {children ?? (category ? label[category] : null)}
    </Badge>
  );
}

export { Tag };
