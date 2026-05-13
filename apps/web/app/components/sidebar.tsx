import { BarChart3, Blocks, Coins, Link2, Network, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../design-system/lib/utils";

const sidebarItems = [
  { href: "/", icon: Network, isActive: true, label: "Flow" },
  { href: "/entities", icon: Blocks, label: "Entities" },
  { href: "/", icon: Coins, label: "Assets" },
  { href: "/", icon: Link2, label: "Chains" },
  { href: "/design-system", icon: BarChart3, hasBadge: true, label: "Stats" },
];

export function AppSidebar() {
  return (
    <aside
      className="sticky top-0 z-10 flex h-screen flex-col items-center border-border border-r bg-glass py-3.5 backdrop-blur-xl backdrop-saturate-150"
      aria-label="Stableflow navigation"
    >
      <Link
        className="mb-5 inline-flex size-8 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/10 shadow-sm"
        to="/"
        aria-label="Stableflow home"
      >
        <img alt="" className="block size-full" height="32" src="/brand-icon.svg" width="32" />
      </Link>

      <nav className="flex w-full flex-col items-center gap-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;

          return (
            <SidebarItem
              hasBadge={item.hasBadge}
              icon={<Icon size={16} strokeWidth={1.6} />}
              isActive={item.isActive}
              key={item.label}
              label={item.label}
              to={item.href}
            />
          );
        })}
      </nav>

      <div className="flex-1" />
      <div className="my-2 h-px w-6 bg-border" />
      <SidebarItem
        icon={<Settings size={16} strokeWidth={1.6} />}
        label="Settings"
        to="/design-system"
      />
    </aside>
  );
}

function SidebarItem({
  hasBadge,
  icon,
  isActive,
  label,
  to,
}: {
  hasBadge?: boolean;
  icon: ReactNode;
  isActive?: boolean;
  label: string;
  to: string;
}) {
  return (
    <Link
      aria-label={label}
      className={cn(
        "group relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground",
        isActive &&
          "bg-surface-3 text-foreground ring-1 ring-border before:absolute before:top-1/2 before:-left-2.5 before:h-3.5 before:w-1 before:-translate-y-1/2 before:rounded-sm before:bg-accent before:shadow-glow-accent before:content-['']",
      )}
      to={to}
    >
      {icon}
      {hasBadge && (
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-anomaly ring-2 ring-background" />
      )}
      <span className="pointer-events-none absolute top-1/2 left-11 z-50 -translate-y-1/2 -translate-x-1 whitespace-nowrap rounded-sm border border-border bg-surface-3 px-2.5 py-1.5 font-mono text-2xs text-foreground uppercase tracking-wider opacity-0 shadow-sm transition duration-fast group-hover:translate-x-0 group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}
