import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import {
  data,
  type HeadersFunction,
  isRouteErrorResponse,
  Link,
  Links,
  type LinksFunction,
  Meta,
  type MetaFunction,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import { AppPage } from "./components/app-page";
import { TooltipProvider } from "./components/ui/tooltip";
import { getMcpPublicUrl } from "./config/mcp.server";
import { isNonCanonicalHost, site } from "./config/site";
import { SearchDialogProvider } from "./features/search/search-dialog";
import geistLatinHref from "./fonts/geist-latin.woff2?url";
import geistMonoLatinHref from "./fonts/geist-mono-latin.woff2?url";
import { readThemeCookie } from "./styles/tokens";
import stylesHref from "./styles.css?url";
import { errorSeo } from "./utils/seo";

// Geist and Geist Mono (styles/fonts.css) render above the fold on every page; preloading their
// latin files starts the download with the HTML instead of after the stylesheet is parsed.
const fontPreloads = [geistLatinHref, geistMonoLatinHref];

export const links: LinksFunction = () => [
  { href: stylesHref, rel: "stylesheet" },
  ...fontPreloads.map((href) => ({
    as: "font",
    crossOrigin: "anonymous" as const,
    href,
    rel: "preload",
    type: "font/woff2",
  })),
  // Entity and protocol logos come from DefiLlama's icon CDN.
  { href: "https://icons.llamao.fi", rel: "dns-prefetch" },
  { href: "/favicon.ico", rel: "icon", sizes: "48x48" },
  { href: "/brand-icon.svg", rel: "icon", type: "image/svg+xml" },
  { href: "/apple-touch-icon.png", rel: "apple-touch-icon" },
  { href: "/manifest.webmanifest", rel: "manifest" },
];

// Only rendered for errors: every page route has its own meta, and those replace this one.
export const meta: MetaFunction = ({ error }) =>
  error ? errorSeo(isRouteErrorResponse(error) ? error.status : 500) : [];

export function loader({ request }: { request: Request }) {
  const headers = new Headers();
  // The Railway service domain serves the same pages as the real domain; keep it out of indexes.
  if (isNonCanonicalHost(new URL(request.url).host)) headers.set("X-Robots-Tag", "noindex");

  // Rendered on the server so the first paint already has the chosen theme (no flash).
  return data(
    { mcpUrl: getMcpPublicUrl(), theme: readThemeCookie(request.headers.get("cookie")) },
    { headers },
  );
}

// Routes without their own headers export inherit these.
export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const headers = new Headers(loaderHeaders);
  // Lets a CDN with Early Hints (Cloudflare) send these before the page is rendered.
  headers.append(
    "Link",
    [
      ...fontPreloads.map(
        (href) => `<${href}>; rel=preload; as=font; type="font/woff2"; crossorigin`,
      ),
      `<${stylesHref}>; rel=preload; as=style`,
    ].join(", "),
  );
  return headers;
};

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useRouteLoaderData<typeof loader>("root")?.theme ?? "dark";

  return (
    <html className={theme} data-theme={theme} lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content={site.themeColor[theme]} name="theme-color" />
        {/* Block numbers and amounts are not phone numbers; stops iOS from linking them. */}
        <meta content="telephone=no" name="format-detection" />
        <meta content={site.name} name="application-name" />
        <meta content={site.name} name="apple-mobile-web-app-title" />
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
