import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Entity } from "~/components";
import { cn } from "~/utils/cn";

const exampleWallet = "0x71c9a8e0b5d4f3c2a1e9d8c7b6a5f4e3d2c1a2f3";

/**
 * Worked example of entity accounting: USDC enters an exchange, moves between two of its own
 * addresses, then leaves. The picture carries the rule; the equation underneath carries the numbers.
 */
export function FlowExample() {
  return (
    <figure className="m-0 grid gap-4">
      <div className="grid items-center justify-items-center gap-1 rounded-lg border border-border bg-background px-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,2.2fr)_auto_minmax(0,1fr)] lg:gap-2 lg:px-5">
        <FlowNode caption="Outside wallet">
          <Entity address={exampleWallet} isWallet name="0x71c9...a2f3" />
        </FlowNode>
        <FlowArrow amount="500" label="Inflow" layout="lg" tone="inflow" />
        {/* The dashed outline is the entity boundary: only arrows crossing it are counted. */}
        <div className="w-full max-w-md rounded-lg border-2 border-[var(--border-strong)] border-dashed px-3 pt-2.5 pb-3.5 lg:max-w-none">
          <p className="eyebrow m-0 text-center">Exchange · one entity</p>
          <div className="mt-3 grid items-center justify-items-center gap-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2">
            <FlowNode>
              <Entity category="cex" glyph="D" name="Deposit address" />
            </FlowNode>
            <FlowArrow amount="500" label="Internal" layout="sm" tone="internal" />
            <FlowNode>
              <Entity category="cex" glyph="H" name="Hot wallet" />
            </FlowNode>
          </div>
        </div>
        <FlowArrow amount="300" label="Outflow" layout="lg" tone="outflow" />
        <FlowNode caption="Another entity">
          <Entity category="dex" glyph="DX" name="DEX" />
        </FlowNode>
      </div>

      <figcaption className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex items-end gap-3 sm:gap-4">
          <EquationTerm className="text-inflow" label="Inflow" value="+500" />
          <EquationOperator>−</EquationOperator>
          <EquationTerm className="text-outflow" label="Outflow" value="300" />
          <EquationOperator>=</EquationOperator>
          <EquationTerm className="text-foreground" label="Net flow" value="+200" />
        </div>
        <p className="m-0 text-muted-foreground text-sm">
          The 500 moved between the exchange's own addresses is not counted.
        </p>
      </figcaption>
    </figure>
  );
}

function FlowNode({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <div className="max-w-full rounded-md border border-border bg-surface-1 px-3 py-2 shadow-xs">
        {children}
      </div>
      {caption && <span className="text-muted-foreground text-xs">{caption}</span>}
    </div>
  );
}

const arrowTones = {
  inflow: "text-inflow",
  internal: "text-muted-foreground",
  outflow: "text-outflow",
} as const;

// Arrows point down while their row is stacked and turn right once it goes horizontal. The outer
// row goes horizontal at lg, the narrower row inside the entity already at sm.
const arrowLayouts = {
  lg: {
    down: "lg:hidden",
    line: "h-6 border-l-2 lg:h-0 lg:w-12 lg:border-t-2 lg:border-l-0 xl:w-16",
    right: "hidden lg:block",
    track: "flex-col lg:flex-row",
  },
  sm: {
    down: "sm:hidden",
    line: "h-6 border-l-2 sm:h-0 sm:w-10 sm:border-t-2 sm:border-l-0",
    right: "hidden sm:block",
    track: "flex-col sm:flex-row",
  },
} as const;

function FlowArrow({
  amount,
  label,
  layout,
  tone,
}: {
  amount: string;
  label: string;
  layout: keyof typeof arrowLayouts;
  tone: keyof typeof arrowTones;
}) {
  const classes = arrowLayouts[layout];
  const internal = tone === "internal";

  return (
    <div className={cn("flex flex-col items-center gap-0.5 py-1", arrowTones[tone])}>
      <span
        className={cn("font-medium font-mono text-sm tabular-nums", internal && "line-through")}
      >
        {amount}
      </span>
      <span aria-hidden className={cn("flex items-center", classes.track)}>
        <span className={cn(classes.line, internal && "border-dashed")} />
        <ChevronDown className={cn("-mt-2", classes.down)} size={14} strokeWidth={2.25} />
        <ChevronRight className={cn("-ml-2", classes.right)} size={14} strokeWidth={2.25} />
      </span>
      <span className="font-mono text-2xs uppercase tracking-[0.06em]">{label}</span>
    </div>
  );
}

function EquationTerm({
  className,
  label,
  value,
}: {
  className: string;
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="eyebrow">{label}</span>
      <span className={cn("font-medium font-mono text-xl tabular-nums", className)}>{value}</span>
    </div>
  );
}

function EquationOperator({ children }: { children: ReactNode }) {
  return <span className="pb-0.5 font-mono text-muted-foreground text-xl">{children}</span>;
}
