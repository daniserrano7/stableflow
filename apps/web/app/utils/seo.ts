import type { MetaDescriptor } from "react-router";
import { absoluteUrl, site } from "~/config/site";

/** A schema.org node; every page publishes its nodes as one JSON-LD @graph. */
export type JsonLdNode = Record<string, unknown>;

export interface Breadcrumb {
  name: string;
  path: string;
}

interface SeoOptions {
  /** Page title without the site name; `fullTitle` replaces the whole <title> instead. */
  title?: string;
  fullTitle?: string;
  description: string;
  /** Canonical path, including any query that defines the page (e.g. `/transfers?filter=whale`). */
  path: string;
  /** Pages that should stay out of search results (still crawled, so their links count). */
  noindex?: boolean;
  /** Trail after Home; the page itself is the last item. Published as a BreadcrumbList. */
  breadcrumbs?: Breadcrumb[];
  /** schema.org type of the page node: WebPage, CollectionPage, ItemPage, FAQPage… */
  pageType?: string | string[];
  /** Extra properties for the page node (about, mainEntity, dateModified…). */
  page?: JsonLdNode;
  /** Further nodes for the graph (datasets, item lists…). */
  nodes?: JsonLdNode[];
}

const organizationId = `${site.url}/#organization`;
const websiteId = `${site.url}/#website`;
const indexRobots = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

export const pageId = (path: string) => `${absoluteUrl(path)}#webpage`;

/** Title, description, canonical, robots, Open Graph, Twitter card and JSON-LD for one page. */
export function seo({
  breadcrumbs,
  description,
  fullTitle,
  noindex = false,
  nodes = [],
  page,
  pageType = "WebPage",
  path,
  title,
}: SeoOptions): MetaDescriptor[] {
  const documentTitle = fullTitle ?? `${title} | ${site.name}`;
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(site.image.path);
  const breadcrumbList =
    breadcrumbs && breadcrumbs.length > 0 ? breadcrumbNode(url, breadcrumbs) : null;

  const graph: JsonLdNode[] = [
    organizationNode(),
    websiteNode(),
    {
      "@type": pageType,
      "@id": `${url}#webpage`,
      url,
      name: documentTitle,
      description,
      inLanguage: site.language,
      isPartOf: { "@id": websiteId },
      publisher: { "@id": organizationId },
      primaryImageOfPage: { "@type": "ImageObject", url: imageUrl },
      ...(breadcrumbList ? { breadcrumb: { "@id": breadcrumbList["@id"] } } : {}),
      ...page,
    },
    ...(breadcrumbList ? [breadcrumbList] : []),
    ...nodes,
  ];

  return [
    { title: documentTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { name: "robots", content: noindex ? "noindex, follow" : indexRobots },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: site.name },
    { property: "og:locale", content: site.locale },
    { property: "og:url", content: url },
    { property: "og:title", content: documentTitle },
    { property: "og:description", content: description },
    { property: "og:image", content: imageUrl },
    { property: "og:image:type", content: site.image.type },
    { property: "og:image:width", content: String(site.image.width) },
    { property: "og:image:height", content: String(site.image.height) },
    { property: "og:image:alt", content: site.image.alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: documentTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: site.image.alt },
    { "script:ld+json": { "@context": "https://schema.org", "@graph": graph } },
  ];
}

function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: site.name,
    url: `${site.url}/`,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(site.logo.path),
      width: site.logo.width,
      height: site.logo.height,
    },
    sameAs: [site.repositoryUrl],
  };
}

function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    url: `${site.url}/`,
    name: site.name,
    description: site.description,
    inLanguage: site.language,
    publisher: { "@id": organizationId },
  };
}

function breadcrumbNode(url: string, breadcrumbs: Breadcrumb[]): JsonLdNode {
  const trail = [{ name: "Home", path: "/" }, ...breadcrumbs];

  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** `ItemList` of links, e.g. the entities a collection page lists. */
export function itemListNode(id: string, items: { name: string; path?: string }[]): JsonLdNode {
  return {
    "@type": "ItemList",
    "@id": id,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { url: absoluteUrl(item.path) } : {}),
    })),
  };
}

/** Meta for error responses: a clear title, and kept out of the index. */
export function errorSeo(status: number): MetaDescriptor[] {
  const title =
    status === 404
      ? "Page Not Found"
      : status === 400
        ? "Invalid Request"
        : "Temporarily Unavailable";

  return [{ title: `${title} | ${site.name}` }, { name: "robots", content: "noindex" }];
}
