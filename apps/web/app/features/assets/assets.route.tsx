import type { FlowKpisResponse } from "@stableflow/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import {
  Chip,
  KPI,
  Panel,
  PanelBody,
  PanelHead,
  PanelTitle,
  Sparkline,
  VisualMark,
} from "~/components";
import { AppPage } from "~/components/app-page";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { getApiUrl } from "~/config/api.server";
import { absoluteUrl } from "~/config/site";
import { getVisualIdentity } from "~/config/visuals";
import { fmtUSD, shortAddr } from "~/utils/format";
import { itemListNode, seo } from "~/utils/seo";
import {
  fetchFlowKpis,
  flowKpisQueryKey,
  flowKpisRefreshIntervalMs,
} from "../flow-kpis/flow-kpis.query";
import { assetsPagePath, selectedAssetChain as chain } from "./assets.config";

export function meta() {
  const path = assetsPagePath;
  const listId = `${absoluteUrl(path)}#assets`;

  return seo({
    breadcrumbs: [{ name: "Assets", path }],
    description: `Stablecoins on ${chain.name} and what Stableflow indexes for each: native USDC is tracked live with 24h volume and hourly transfers; ${chain.assets
      .filter((asset) => asset.status === "preview")
      .map((asset) => asset.symbol)
      .join(" and ")} are listed as previews.`,
    nodes: [
      itemListNode(
        listId,
        chain.assets.map((asset) => ({ name: `${asset.name} (${asset.symbol})` })),
      ),
    ],
    page: { mainEntity: { "@id": listId } },
    pageType: "CollectionPage",
    path,
    title: `Stablecoins on ${chain.name}: ${chain.assets.map((asset) => asset.symbol).join(", ")}`,
  });
}

export async function loader({ request }: { request: Request }) {
  try {
    const response = await fetch(getApiUrl("/flows/kpis"), {
      headers: { accept: "application/json" },
      signal: request.signal,
    });
    if (!response.ok) return { kpis: null };
    return { kpis: (await response.json()) as FlowKpisResponse | null };
  } catch (error) {
    if (request.signal.aborted) throw error;
    return { kpis: null };
  }
}

export default function Assets() {
  const { kpis: initialKpis } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [status, setStatus] = useState("all");

  useEffect(() => setQuery(urlQuery), [urlQuery]);

  const kpisQuery = useQuery({
    queryKey: flowKpisQueryKey,
    queryFn: ({ signal }) => fetchFlowKpis({ signal }),
    initialData: initialKpis ?? undefined,
    initialDataUpdatedAt: initialKpis ? Date.parse(initialKpis.meta.generatedAt) : undefined,
    refetchInterval: flowKpisRefreshIntervalMs,
    staleTime: 10_000,
    retry: 2,
  });
  const volume = kpisQuery.data?.data.find((card) => card.id === "usdc-volume-24h");
  const transfers = kpisQuery.data?.data.find((card) => card.id === "transfers-1h");
  const volumeValue = volume ? fmtUSD(Number(volume.value.formatted)) : "—";
  const transferValue = transfers ? Number(transfers.value.formatted).toLocaleString("en-US") : "—";
  const trackedCount = chain.assets.filter((asset) => asset.status === "tracked").length;
  const visibleAssets = chain.assets.filter(
    (asset) =>
      (status === "all" || asset.status === status) &&
      `${asset.symbol} ${asset.name} ${asset.contract ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  return (
    <AppPage breadcrumbs={[{ label: "Assets" }]} headingId="assets-title">
      <PageHeader
        description={`Stablecoins on ${chain.name} and what Stableflow indexes for each. Native USDC is tracked today; the others are previews.`}
        id="assets-title"
        title="Assets"
      />
      <section
        aria-label="Base tracked asset summary"
        className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KPI label="Tracked assets" value={trackedCount} unit={`/ ${chain.assets.length} listed`} />
        <KPI label="Preview assets" value={chain.assets.length - trackedCount} />
        <KPI
          label="USDC volume · 24h"
          value={volumeValue}
          spark={volume && <Sparkline data={volume.series.map((point) => Number(point.value))} />}
        />
        <KPI
          label="USDC transfers · 1h"
          value={transferValue}
          spark={
            transfers && <Sparkline data={transfers.series.map((point) => Number(point.value))} />
          }
        />
      </section>
      {(kpisQuery.isError || !kpisQuery.data) && (
        <p role="status" className="text-sm text-muted-foreground">
          {kpisQuery.isError
            ? "Activity metrics are temporarily unavailable. Retrying automatically."
            : "Loading activity metrics…"}
          {kpisQuery.isError && kpisQuery.data ? " Showing the last available values." : ""}
        </p>
      )}
      {/* items-start: each column is as tall as its own content, not stretched to its neighbour. */}
      <div className="grid min-w-0 items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel>
          <PanelHead className="flex-wrap gap-3">
            <PanelTitle>{chain.name} assets</PanelTitle>
            <span className="font-mono text-2xs text-muted-foreground">
              {visibleAssets.length} {visibleAssets.length === 1 ? "asset" : "assets"}
            </span>
          </PanelHead>
          <PanelBody className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <ToggleGroup
              aria-label="Asset status"
              type="single"
              value={status}
              onValueChange={(value) => {
                if (value) setStatus(value);
              }}
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="tracked">Tracked</ToggleGroupItem>
              <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
            </ToggleGroup>
            <label className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-muted-foreground">
              <Search size={14} className="shrink-0" />
              <input
                aria-label="Filter assets"
                type="search"
                placeholder="Filter assets..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 w-full bg-transparent text-foreground outline-none"
              />
            </label>
          </PanelBody>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Volume · 24h</TableHead>
                <TableHead className="text-right">Transfers · 1h</TableHead>
                <TableHead>
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAssets.map((asset) => (
                <TableRow key={asset.symbol}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <AssetVisual color={asset.color} symbol={asset.symbol} />
                      <div>
                        <span className="font-medium">{asset.symbol}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {asset.name}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      pulse={false}
                      dotColor={
                        asset.status === "tracked" ? "var(--inflow)" : "var(--muted-foreground)"
                      }
                    >
                      {asset.status === "tracked" ? "Tracked" : "Preview"}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {asset.status === "tracked" ? volumeValue : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {asset.status === "tracked" ? transferValue : "—"}
                  </TableCell>
                  <TableCell>
                    {asset.status === "tracked" ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/">
                          View flows
                          <ArrowUpRight size={14} />
                        </Link>
                      </Button>
                    ) : (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        Not indexed
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleAssets.length === 0 && (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground">
              No assets match the current filters.
            </p>
          )}
        </Panel>
        <aside aria-label="Chain coverage" className="flex min-w-0 flex-col gap-3.5">
          <Panel>
            <PanelHead>
              <PanelTitle>
                <ChainVisual />
                Network overview
              </PanelTitle>
            </PanelHead>
            <PanelBody>
              <dl className="space-y-3 font-mono text-xs">
                <Detail label="Chain" value={chain.name} />
                <Detail label="Network" value={chain.network} />
                <Detail label="Chain ID" value={chain.id.toString()} />
                <Detail label="Indexed assets" value={trackedCount.toString()} />
              </dl>
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                Activity totals cover tracked USDC transfers only. Preview assets are illustrative
                and have no indexed activity.
              </p>
              <nav
                aria-label={`${chain.name} resources`}
                className="mt-4 grid gap-1.5 border-t border-border pt-4"
              >
                {chain.resources.map((resource) => (
                  <a
                    className="group flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground no-underline transition-colors hover:bg-surface-2 hover:text-foreground"
                    href={resource.href}
                    key={resource.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {resource.label}
                    <ArrowUpRight
                      aria-hidden
                      className="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      size={14}
                    />
                  </a>
                ))}
              </nav>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHead>
              <PanelTitle>Tracked contracts</PanelTitle>
            </PanelHead>
            <PanelBody className="space-y-3">
              {chain.assets
                .filter((asset) => asset.contract)
                .map((asset) => (
                  <div
                    key={asset.symbol}
                    className="flex items-center justify-between gap-2 font-mono text-xs"
                  >
                    <span>{asset.symbol}</span>
                    <span className="flex items-center gap-1">
                      <span title={asset.contract} className="text-muted-foreground">
                        {shortAddr(asset.contract ?? "")}
                      </span>
                      {asset.contractExplorerUrl && (
                        <Button asChild size="icon-sm" variant="ghost">
                          <a
                            aria-label={`View ${asset.symbol} contract on BaseScan`}
                            href={asset.contractExplorerUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ArrowUpRight />
                          </a>
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
            </PanelBody>
          </Panel>
        </aside>
      </div>
    </AppPage>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AssetVisual({ color, symbol }: { color: string; symbol: string }) {
  const visual = getVisualIdentity("asset", symbol);

  return (
    <VisualMark
      className="size-9 rounded-full border border-border font-mono font-medium"
      fallback="$"
      imageName={visual?.name}
      imageSize={36}
      imageUrl={visual?.imageUrl}
      style={{ color }}
    />
  );
}

function ChainVisual() {
  const visual = getVisualIdentity("chain", chain.id);

  return (
    <VisualMark
      className="size-5 rounded-full"
      fallback={chain.name.slice(0, 1)}
      imageName={visual?.name}
      imageSize={20}
      imageUrl={visual?.imageUrl}
    />
  );
}
