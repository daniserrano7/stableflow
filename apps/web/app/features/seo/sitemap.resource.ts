import { absoluteUrl } from "~/config/site";
import { fetchEntityCatalog } from "./entity-catalog.server";
import { sitePages } from "./site-pages";

export async function loader({ request }: { request: Request }) {
  const entities = await fetchEntityCatalog(request.signal);
  const now = new Date().toISOString();
  const urls = [
    ...sitePages.map((page) => ({ lastmod: page.live ? now : null, path: page.path })),
    ...(entities ?? []).map((entity) => ({
      lastmod: now,
      path: `/entities/${encodeURIComponent(entity.entityId)}`,
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      ({ lastmod, path }) =>
        `  <url><loc>${escapeXml(absoluteUrl(path))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
    ),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      // Short-lived when the registry was unavailable, so the entity pages come back soon.
      "Cache-Control": `public, max-age=${entities ? 3600 : 300}`,
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
