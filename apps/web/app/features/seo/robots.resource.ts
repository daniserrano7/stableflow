import { absoluteUrl } from "~/config/site";

// Data endpoints, the live event stream and transfer pagination cursors are not pages: crawling
// them only spends crawl budget (the stream never ends, cursors never repeat).
const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /events/
Disallow: /health
Disallow: /*cursor=

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;

export function loader() {
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
