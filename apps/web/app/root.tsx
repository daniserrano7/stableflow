import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  type LinksFunction,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import { PublicPage } from "./components/public-page";
import { TooltipProvider } from "./components/ui/tooltip";
import { SearchDialogProvider } from "./features/search/search-dialog";
import stylesHref from "./styles.css?url";

export const links: LinksFunction = () => [
  { href: stylesHref, rel: "stylesheet" },
  { href: "/brand-icon.svg", rel: "icon", type: "image/svg+xml" },
  { href: "/brand-icon.svg", rel: "apple-touch-icon" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html className="dark" data-theme="dark" lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SearchDialogProvider>
        <TooltipProvider delayDuration={150}>
          <Outlet />
        </TooltipProvider>
      </SearchDialogProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const title =
    status === 404
      ? "Page not found"
      : status === 400
        ? "Invalid request"
        : "Unable to load this page";
  return (
    <TooltipProvider>
      <PublicPage title={title}>
        <div className="rounded-lg border border-border bg-glass p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            {status === 404
              ? "This page or entity could not be found."
              : status === 400
                ? "Check the page filters or start again from the links below."
                : "Data is temporarily unavailable. Please try again."}
          </p>
          <nav
            aria-label="Recovery navigation"
            className="flex flex-wrap gap-4 text-sm text-accent"
          >
            <Link to="/">Home</Link>
            <Link to="/movements">Movements</Link>
            <Link to="/entities">Entities</Link>
            <Link to="/methodology">Methodology</Link>
          </nav>
        </div>
      </PublicPage>
    </TooltipProvider>
  );
}
