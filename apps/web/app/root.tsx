import { Links, type LinksFunction, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import stylesHref from "./styles.css?url";

export const links: LinksFunction = () => [{ href: stylesHref, rel: "stylesheet" }];

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
  return <Outlet />;
}
