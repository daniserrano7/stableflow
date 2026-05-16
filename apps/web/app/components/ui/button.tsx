import { Slot as SlotPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "~/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110 shadow-[var(--shadow-sm)]",
        secondary: "bg-surface-2 text-foreground border border-border hover:bg-surface-3",
        ghost: "bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        outline: "border border-border bg-transparent text-foreground hover:bg-surface-2",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        glow: "bg-primary text-primary-foreground shadow-[var(--shadow-glow-accent)] hover:brightness-110",
        link: "bg-transparent text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-7 px-2.5 text-xs rounded-[var(--radius-sm)]",
        md: "h-8 px-3 text-sm rounded-[var(--radius-md)]",
        lg: "h-10 px-4 text-md rounded-[var(--radius-md)]",
        icon: "h-8 w-8 rounded-[var(--radius-md)] [&_svg]:size-[14px]",
        "icon-sm": "h-7 w-7 rounded-[var(--radius-sm)] [&_svg]:size-3",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, ...props }, ref) => {
    const Comp = asChild ? SlotPrimitive.Slot : "button";

    return (
      <Comp ref={ref} className={cn(buttonVariants({ size, variant }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
