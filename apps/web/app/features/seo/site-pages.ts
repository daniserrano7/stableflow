import { assetsPagePath } from "../assets/assets.config";

/**
 * Indexable pages that exist regardless of data, for the sitemap and llms.txt. Entity pages are
 * added from the registry. Transfer detail pages are left out on purpose: raw transfers expire
 * after 14 days and those pages are noindex.
 */
export const sitePages: {
  /** Data on the page changes continuously (its lastmod is "now"). */
  live: boolean;
  path: string;
  summary: string;
  title: string;
}[] = [
  {
    live: true,
    path: "/",
    summary:
      "24h USDC volume, hourly transfers, top net mover and bridge net flow, the flow graph between entities, top entity flows and the live transfer feed.",
    title: "Overview",
  },
  {
    live: true,
    path: "/transfers",
    summary: "Every native USDC transfer indexed on Base, newest first, streamed live.",
    title: "USDC transfers",
  },
  {
    live: true,
    path: "/transfers?filter=large",
    summary: "Transfers of 10,000 USDC or more.",
    title: "Large USDC transfers (≥ 10K)",
  },
  {
    live: true,
    path: "/transfers?filter=whale",
    summary: "Whale transfers of 1,000,000 USDC or more.",
    title: "USDC whale transfers (≥ 1M)",
  },
  {
    live: true,
    path: "/entities",
    summary:
      "The registry of protocols, exchanges, bridges and issuers Stableflow recognises on Base, with their addresses, labels and 24h net flow.",
    title: "Entities",
  },
  {
    live: true,
    path: assetsPagePath,
    summary: "Stablecoins on Base and what Stableflow indexes for each.",
    title: "Assets",
  },
  {
    live: false,
    path: "/methodology",
    summary:
      "How flows are measured: address labels, entity boundaries, inflow, outflow and net flow, multi-hop swaps, bridges, mints and burns, and coverage limits.",
    title: "Methodology",
  },
];
