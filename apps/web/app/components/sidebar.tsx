import { ArrowLeftRight, Blocks, BookOpen, Coins, Network, Palette } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useRouteLoaderData } from "react-router";
import { assetsPagePath } from "../features/assets/assets.config";
import type { ThemeMode } from "../styles/tokens";
import { cn } from "../utils/cn";
import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const sidebarItems = [
  { href: "/", icon: Network, label: "Overview" },
  { href: "/entities", icon: Blocks, label: "Entities" },
  { href: assetsPagePath, icon: Coins, label: "Assets" },
  { href: "/transfers", icon: ArrowLeftRight, label: "Transfers" },
  { href: "/methodology", icon: BookOpen, label: "Methodology" },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const theme = (useRouteLoaderData("root") as { theme: ThemeMode } | undefined)?.theme ?? "dark";

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
        <BrandMark className="block size-full" />
      </Link>

      <nav className="flex w-full flex-col items-center gap-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;

          return (
            <SidebarItem
              icon={<Icon size={16} strokeWidth={1.6} />}
              isActive={isSidebarItemActive(pathname, item.href, item.label)}
              key={item.label}
              label={item.label}
              to={item.href}
            />
          );
        })}
      </nav>

      <div className="flex-1" />
      <ThemeToggle initialTheme={theme} />
      <div className="my-2 h-px w-6 bg-border" />
      <SidebarItem
        icon={<Palette size={16} strokeWidth={1.6} />}
        isActive={pathname === "/design-system"}
        label="Design System"
        to="/design-system"
      />
    </aside>
  );
}

function isSidebarItemActive(pathname: string, href: string, label: string) {
  if (href === "/") {
    return label === "Overview" && pathname === "/";
  }

  // Compare without a trailing slash: the assets page lives at "/assets/".
  const path = pathname.replace(/\/$/, "");
  const target = href.replace(/\/$/, "");
  return path === target || path.startsWith(`${target}/`);
}

export function SidebarItem({
  icon,
  isActive,
  label,
  to,
}: {
  icon: ReactNode;
  isActive?: boolean;
  label: string;
  to: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground",
            isActive &&
              "bg-surface-3 text-foreground ring-1 ring-border before:absolute before:top-1/2 before:-left-2.5 before:h-3.5 before:w-1 before:-translate-y-1/2 before:rounded-sm before:bg-accent before:shadow-glow-accent before:content-['']",
          )}
          to={to}
        >
          {icon}
          {/* Real link text rather than aria-label: crawlers read it as the link's anchor text. */}
          <span className="sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
