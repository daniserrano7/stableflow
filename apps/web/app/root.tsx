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
  useRouteLoaderData,
} from "react-router";
import { AppPage } from "./components/app-page";
import { TooltipProvider } from "./components/ui/tooltip";
import { SearchDialogProvider } from "./features/search/search-dialog";
import { readThemeCookie } from "./styles/tokens";
import stylesHref from "./styles.css?url";

export const links: LinksFunction = () => [
  // Geist / Geist Mono are the design system's fonts (tokens.css); without this they never load
  // and every page silently falls back to the system UI font.
  { href: "https://fonts.googleapis.com", rel: "preconnect" },
  { crossOrigin: "anonymous", href: "https://fonts.gstatic.com", rel: "preconnect" },
  {
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap",
    rel: "stylesheet",
  },
  { href: stylesHref, rel: "stylesheet" },
  { href: "/brand-icon.svg", rel: "icon", type: "image/svg+xml" },
  { href: "/brand-icon.svg", rel: "apple-touch-icon" },
];

export function loader({ request }: { request: Request }) {
  const configuredUrl = process.env.STABLEFLOW_MCP_PUBLIC_URL;
  const mcpUrl =
    configuredUrl || (process.env.NODE_ENV === "development" ? "http://localhost:3002/mcp" : null);
  // Rendered on the server so the first paint already has the chosen theme (no flash).
  return { mcpUrl, theme: readThemeCookie(request.headers.get("cookie")) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useRouteLoaderData<typeof loader>("root")?.theme ?? "dark";

  return (
    <html className={theme} data-theme={theme} lang="en">
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

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });

export default function App() {
  const [queryClient] = useState(createQueryClient);

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
  // The boundary replaces App, so it must provide what AppPage's header search needs.
  const [queryClient] = useState(createQueryClient);
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const title =
    status === 404
      ? "Page not found"
      : status === 400
        ? "Invalid request"
        : "Unable to load this page";
  return (
    <QueryClientProvider client={queryClient}>
      <SearchDialogProvider>
        <TooltipProvider>
          <AppPage breadcrumbs={[{ label: title }]}>
            <div className="rounded-lg border border-border bg-glass p-6">
              <p className="mb-4 text-sm text-muted-foreground">
                {status === 404
                  ? "This page, entity, or transfer could not be found."
                  : status === 400
                    ? "Check the page filters or start again from the links below."
                    : "Data is temporarily unavailable. Please try again."}
              </p>
              <nav
                aria-label="Recovery navigation"
                className="flex flex-wrap gap-4 text-sm text-accent"
              >
                <Link to="/">Home</Link>
                <Link to="/transfers">Transfers</Link>
                <Link to="/entities">Entities</Link>
                <Link to="/methodology">Methodology</Link>
              </nav>
            </div>
          </AppPage>
        </TooltipProvider>
      </SearchDialogProvider>
    </QueryClientProvider>
  );
}
