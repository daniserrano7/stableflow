import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "~/utils/cn";

const toggleGroupItemVariants = cva(
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-0 bg-transparent font-mono text-2xs text-muted-foreground uppercase tracking-[0.04em] transition-[color,background] duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface-3 data-[state=active]:text-foreground data-[state=active]:shadow-[0_0_0_1px_var(--border)] data-[state=on]:bg-surface-3 data-[state=on]:text-foreground data-[state=on]:shadow-[0_0_0_1px_var(--border)] aria-selected:bg-surface-3 aria-selected:text-foreground aria-selected:shadow-[0_0_0_1px_var(--border)] [&.is-active]:bg-surface-3 [&.is-active]:text-foreground [&.is-active]:shadow-[0_0_0_1px_var(--border)]",
  {
    variants: {
      size: {
        sm: "px-2.5 py-1.5",
        md: "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
);

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("inline-flex rounded-full border border-border bg-surface-2 p-0.5", className)}
    {...props}
  />
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleGroupItemVariants>
>(({ className, size, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(toggleGroupItemVariants({ size }), className)}
    {...props}
  />
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem, toggleGroupItemVariants };
