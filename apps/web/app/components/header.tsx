import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRouteLoaderData } from "react-router";
import { useSearchDialog } from "~/features/search/search-dialog-context";
import { McpConnectWidget } from "./mcp-connect-widget";
import { ScopeBadges } from "./scope-badges";

export interface HeaderBreadcrumb {
  label: string;
  to?: string;
}

interface AppHeaderProps {
  breadcrumbs?: HeaderBreadcrumb[];
  /** False when the page renders its own <h1>, so the document keeps a single one. */
  brandAsHeading?: boolean;
  headingId?: string;
  searchPlaceholder?: string;
}

export function AppHeader({
  breadcrumbs = [{ label: "Overview" }],
  brandAsHeading = true,
  headingId = "home-title",
  searchPlaceholder = "Search Stableflow...",
}: AppHeaderProps) {
  const { openSearch } = useSearchDialog();
  const Brand = brandAsHeading ? "h1" : "p";
  // Root loader data; absent while an error boundary renders the header.
  const mcpUrl = (useRouteLoaderData("root") as { mcpUrl: string | null } | undefined)?.mcpUrl;
  const [shortcutLabel, setShortcutLabel] = useState("⌘K");

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.userAgent)) {
      setShortcutLabel("Ctrl K");
    }
  }, []);

  return (
    <header className="flex min-h-12 flex-col items-stretch gap-3.5 rounded-lg border border-border bg-glass px-3.5 py-2 backdrop-blur-xl backdrop-saturate-150 lg:flex-row lg:items-center">
      <div className="flex min-w-0 items-center gap-2 lg:min-w-56">
        <div className="min-w-0">
          <Brand id={headingId} className="m-0 text-md font-semibold leading-none tracking-normal">
            Stableflow
            {/* As the page's <h1>, the name alone says little about the page. */}
            {brandAsHeading && <span className="sr-only">: live USDC flows on Base</span>}
          </Brand>
          <nav
            aria-label="Breadcrumb"
            className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden font-mono text-xs leading-none text-muted-foreground"
          >
            {breadcrumbs.map((breadcrumb, index) => (
              <span
                className="flex min-w-0 items-center gap-1.5"
                key={`${breadcrumb.to ?? "current"}-${breadcrumb.label}`}
              >
                {index > 0 && <span aria-hidden>/</span>}
                {breadcrumb.to ? (
                  <Link
                    className="truncate transition-colors hover:text-foreground"
                    to={breadcrumb.to}
                  >
                    {breadcrumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}
                    className="truncate"
                  >
                    {breadcrumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        </div>
      </div>

      <button
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Search Stableflow"
        className="flex min-w-0 max-w-lg flex-1 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-muted-foreground transition-[border-color,background,color,box-shadow] duration-fast hover:border-[var(--border-strong)] hover:bg-surface-3 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-w-56"
        onClick={openSearch}
        type="button"
      >
        <Search size={14} className="shrink-0" />
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {searchPlaceholder}
        </span>
        <kbd className="ml-auto rounded-xs border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
          {shortcutLabel}
        </kbd>
      </button>

      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <ScopeBadges />
        <McpConnectWidget mcpUrl={mcpUrl ?? null} />
      </div>
    </header>
  );
}
