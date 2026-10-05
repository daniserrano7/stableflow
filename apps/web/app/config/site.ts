/**
 * Public identity of the site: canonical URLs, social cards, structured data and crawler files
 * all read from here.
 *
 * The origin is fixed rather than read from the request, so pages reached through another host
 * (the Railway service domain, a preview) still point search engines at the production URL.
 */
export const site = {
  /** Production origin, no trailing slash. */
  url: "https://stableflow.dev",
  name: "Stableflow",
  /** Short positioning line; used after the name in the home title and the manifest. */
  tagline: "Live USDC Flows on Base",
  description:
    "Track native USDC on Base in real time: entity inflows, outflows and net flow for protocols, exchanges and bridges, plus every large and whale transfer.",
  locale: "en_US",
  language: "en",
  repositoryUrl: "https://github.com/daniserrano7/stableflow",
  image: {
    alt: "Stableflow: live USDC flows on Base",
    height: 630,
    path: "/og-image.png",
    type: "image/png",
    width: 1200,
  },
  logo: {
    height: 512,
    path: "/icon-512.png",
    width: 512,
  },
  /** <meta name="theme-color"> per theme; the --background token of each, as hex. */
  themeColor: {
    dark: "#05080d",
    light: "#ecf0f6",
  },
} as const;

/** Absolute URL on the production origin for a site path (`/entities` → `https://…/entities`). */
export const absoluteUrl = (path: string) => new URL(path, site.url).toString();

/** Hosts that serve the same app but must not be indexed: they would duplicate the real site. */
export const isNonCanonicalHost = (host: string) => host.endsWith(".up.railway.app");
