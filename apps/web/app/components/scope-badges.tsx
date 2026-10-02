import type { ReactNode } from "react";
import { cn } from "~/utils/cn";

interface ScopeItem {
  detail: string;
  label: string;
  mark: ReactNode;
  title: string;
}

// Static for now: Stableflow only indexes native USDC on Base mainnet. Each segment is laid out
// so it can later become a selector trigger that routes to another chain or asset.
const scopeItems: ScopeItem[] = [
  {
    detail: "Mainnet",
    label: "Base",
    mark: <BaseMark />,
    title: "Network: Base mainnet (chain 8453)",
  },
  {
    detail: "Native",
    label: "USDC",
    mark: <UsdcMark />,
    title: "Asset: native USDC (USDbC excluded)",
  },
];

export function ScopeBadges({ className }: { className?: string }) {
  // 38px matches the header search field so both controls share one baseline.
  return (
    <ul
      aria-label="Data scope"
      className={cn(
        "m-0 flex h-[38px] shrink-0 list-none items-stretch rounded-md border border-border bg-surface-2 p-0 font-mono text-xs",
        className,
      )}
    >
      {scopeItems.map((item, index) => (
        <li
          className={cn("flex items-center gap-2 px-3", index > 0 && "border-border border-l")}
          key={item.label}
          title={item.title}
        >
          {item.mark}
          <span className="font-medium text-foreground">{item.label}</span>
          <span className="hidden text-2xs text-muted-foreground uppercase tracking-[0.06em] sm:inline">
            {item.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Brand marks are inline SVG so they stay sharp at 16px on any display density.

function BaseMark() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 111 111">
      <path
        d="M54.921 110.034c30.438 0 55.113-24.632 55.113-55.017C110.034 24.632 85.359 0 54.921 0 26.043 0 2.353 22.171 0 50.392h72.847v9.25H0c2.353 28.22 26.043 50.392 54.921 50.392Z"
        fill="#0052FF"
      />
    </svg>
  );
}

function UsdcMark() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 32 32">
      <circle cx="16" cy="16" fill="#2775CA" r="16" />
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <path d="M12.4 7.2a9.6 9.6 0 0 0 0 17.6M19.6 7.2a9.6 9.6 0 0 1 0 17.6" strokeWidth="1.7" />
        <path
          d="M19 12.4c-.5-1-1.6-1.6-3-1.6-1.8 0-3 .9-3 2.3 0 3.2 6 1.8 6 5.2 0 1.5-1.3 2.5-3 2.5-1.5 0-2.7-.7-3.2-1.8M16 9v1.8M16 20.8v2"
          strokeWidth="1.8"
        />
      </g>
    </svg>
  );
}
