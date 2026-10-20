import type { ReactNode } from "react";
import { Link } from "react-router";
import { AppHeader, type HeaderBreadcrumb } from "./header";
import { AppSidebar } from "./sidebar";

const contentId = "main-content";
const brandHeadingId = "app-title";

interface AppPageProps {
  breadcrumbs: HeaderBreadcrumb[];
  children: ReactNode;
  /** Right-hand footer text; defaults to the data scope. */
  footerNote?: ReactNode;
  /**
   * Id of the page's own <h1>. When set, it labels the page and the header brand stops being a
   * heading, so every page has exactly one <h1>. Without it the brand is the page heading.
   */
  headingId?: string;
  searchPlaceholder?: string;
}

/** The one layout every route renders: backdrop, sidebar, header, content and footer. */
export function AppPage({
  breadcrumbs,
  children,
  footerNote = "Base mainnet · Native USDC only",
  headingId,
  searchPlaceholder,
}: AppPageProps) {
  return (
    <div className="grid min-h-screen grid-cols-[3.5rem_minmax(0,1fr)] bg-background text-foreground">
      <a
        className="fixed top-3 left-3 z-[var(--z-toast)] -translate-y-16 rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground text-sm transition-transform duration-150 focus-visible:translate-y-0"
        href={`#${contentId}`}
      >
        Skip to content
      </a>
      <div className="bg-ambient" />
      <div className="bg-grid" />
      <AppSidebar />
      {/* The skip link's target; tabIndex lets it take focus, which should not draw a ring. */}
      <main
        aria-labelledby={headingId ?? brandHeadingId}
        className="flex min-h-screen min-w-0 flex-col gap-3.5 px-3 pt-4 pb-6 outline-none lg:px-6"
        id={contentId}
        tabIndex={-1}
      >
        <AppHeader
          brandAsHeading={headingId === undefined}
          breadcrumbs={breadcrumbs}
          headingId={brandHeadingId}
          searchPlaceholder={searchPlaceholder}
        />
        {/* display:contents keeps the flex gap while the sections stagger in. */}
        <div className="stagger-enter contents">{children}</div>
        <footer className="mt-auto flex flex-col items-start justify-between gap-3 p-1 font-mono text-2xs text-muted-foreground md:flex-row md:items-center">
          <span>Stableflow · v0.1.0</span>
          <Link className="hover:text-accent" to="/methodology">
            Methodology & coverage
          </Link>
          <span>{footerNote}</span>
        </footer>
      </main>
    </div>
  );
}
