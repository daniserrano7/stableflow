import { Search } from "lucide-react";
import { Chip } from "./chip";

interface AppHeaderProps {
  eyebrow?: string;
  headingId?: string;
  searchPlaceholder?: string;
  title?: string;
}

export function AppHeader({
  eyebrow = "Flow / Base · USDC · Live",
  headingId = "home-title",
  searchPlaceholder = "Search protocol, address, tx hash...",
  title = "Stableflow",
}: AppHeaderProps) {
  return (
    <header className="flex min-h-12 flex-col items-stretch gap-3.5 rounded-lg border border-border bg-glass px-3.5 py-2 backdrop-blur-xl backdrop-saturate-150 lg:flex-row lg:items-center">
      <div className="min-w-0 lg:min-w-56">
        <div>
          <h1 id={headingId} className="m-0 text-md font-semibold leading-none tracking-normal">
            {title}
          </h1>
          <p className="mt-1 mb-0 font-mono text-2xs text-muted-foreground uppercase leading-none tracking-widest">
            {eyebrow}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 max-w-lg flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-muted-foreground lg:min-w-56">
        <Search size={14} className="shrink-0" />
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {searchPlaceholder}
        </span>
        <kbd className="ml-auto rounded-xs border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="flex gap-2 lg:ml-auto">
        <Chip>BASE · MAINNET</Chip>
        <Chip dotColor="var(--asset-usdc)">USDC</Chip>
      </div>
    </header>
  );
}
