// Segmented control — the pill-shaped tab group used in panel heads.

import type * as React from "react";
import { cn } from "../lib/utils";

export interface SegmentedProps<T extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  size?: "sm" | "md";
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div role="tablist" className={cn("sf-seg", className)} {...rest}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          data-state={o.value === value ? "active" : undefined}
          onClick={() => onChange(o.value)}
          className={cn("sf-seg-item", size === "md" && "text-xs px-3 py-1.5")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
