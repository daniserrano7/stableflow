import type { ReactNode } from "react";
import { Link } from "react-router";
import { AppHeader } from "./header";
import { AppSidebar } from "./sidebar";

export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-[3.5rem_minmax(0,1fr)] bg-background text-foreground">
      <div className="bg-ambient" />
      <div className="bg-grid" />
      <AppSidebar />
      <section
        className="flex min-h-screen min-w-0 flex-col gap-3.5 px-3 pt-4 pb-6 lg:px-6"
        aria-labelledby="page-title"
      >
        <AppHeader breadcrumbs={[{ label: title }]} headingId="page-title" />
        {children}
        <footer className="mt-auto flex flex-wrap justify-between gap-3 p-1 font-mono text-2xs text-muted-foreground">
          <Link to="/">Stableflow</Link>
          <span>Base mainnet · Native USDC only</span>
          <Link className="hover:text-accent" to="/methodology">
            Methodology & coverage
          </Link>
        </footer>
      </section>
    </main>
  );
}
