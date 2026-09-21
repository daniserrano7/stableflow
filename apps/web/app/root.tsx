import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Links, type LinksFunction, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
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
