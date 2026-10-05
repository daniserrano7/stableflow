import {
  type LiveTransferParty,
  type LiveTransferRow,
  parseTransferListParams,
  type TransferFilter,
  type TransferListResponse,
  transferThresholds,
} from "@stableflow/shared";
import { ArrowRight } from "lucide-react";
import { Link, type Location, useLoaderData, useNavigation } from "react-router";
import { Amount, Panel, PanelActions, PanelHead, PanelTitle } from "~/components";
import { AppPage } from "~/components/app-page";
import { PageHeader } from "~/components/page-header";
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
import { useRowLink } from "~/hooks/use-row-link";
import { fmtUSDC, fmtUtcTimestamp } from "~/utils/format";
import { seo } from "~/utils/seo";
import { getTransferAmount, getTransferMagnitude } from "../live-transfers/live-transfers.utils";
import { TransferEntity } from "../live-transfers/live-transfers-table";
import {
  liveTransferConnectionLabels,
  useLiveTransfers,
} from "../live-transfers/use-live-transfers";
import { getTransferPath, TransferRowLink } from "./transfer-link";

const formatThreshold = (value: number) => value.toLocaleString("en-US");

const filterSeo: Record<TransferFilter, { description: string; title: string }> = {
  all: {
    description:
      "Live feed of every native USDC transfer on Base, newest first: amount, sender and receiver entities, and the full transaction behind each transfer.",
    title: "USDC Transfers on Base · Live Feed",
  },
  large: {
    description: `Native USDC transfers of ${formatThreshold(transferThresholds.large)} USDC or more on Base, streamed live with the protocols, exchanges and bridges on each side.`,
    title: "Large USDC Transfers on Base (≥ 10K)",
  },
  whale: {
    description: `USDC whale alerts for Base: every native USDC transfer of ${formatThreshold(transferThresholds.whale)} USDC or more, live, with the entities on each side and the full transaction.`,
    title: "USDC Whale Transfers on Base (≥ 1M)",
  },
};

export function meta({ data, location }: { data?: TransferListResponse; location: Location }) {
  const filter = data?.meta.filter ?? "all";
  const path = filter === "all" ? "/transfers" : `/transfers?filter=${filter}`;

  return seo({
    ...filterSeo[filter],
    breadcrumbs: [
      { name: "Transfers", path: "/transfers" },
      ...(filter === "all" ? [] : [{ name: filterSeo[filter].title, path }]),
    ],
    // Older pages are a moving window over history; the first page is the one worth indexing.
    noindex: new URLSearchParams(location.search).has("cursor"),
    pageType: "CollectionPage",
    path,
  });
}

export async function loader({ request }: { request: Request }): Promise<TransferListResponse> {
  const params = new URL(request.url).searchParams;
  try {
    parseTransferListParams(params);
  } catch (error) {
    throw new Response(error instanceof Error ? error.message : "Invalid transfer parameters", {
      status: 400,
    });
  }
  const url = new URL(getApiUrl("/transfers"));
  for (const name of ["filter", "cursor", "direction"]) {
    const value = params.get(name);
    if (value !== null) url.searchParams.set(name, value);
  }
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: request.signal,
  });
  if (!response.ok) throw new Response("Unable to load transfers", { status: response.status });
  return response.json();
}

export default function Transfers() {
  const { data: initialTransfers, meta } = useLoaderData<typeof loader>();
  const pending = useNavigation().state !== "idle";
  // Only the latest page streams; older pages are a stable slice of history.
  const isLatestPage = meta.newerCursor === null;
  const {
    connectionStatus,
    freshTransferIds,
    transfers: data,
  } = useLiveTransfers({
    enabled: isLatestPage,
    filter: meta.filter,
    initialTransfers,
    maxBufferedRows: meta.limit,
  });
  const rowLink = useRowLink();
  const olderCursor = getOlderCursor({ data, initialTransfers, isLatestPage, meta });
  const amounts = data.map(getTransferAmount);
  const pageTotal = amounts.reduce((total, amount) => total + amount, 0);
  const averageTransfer = data.length > 0 ? pageTotal / data.length : 0;
  const largestTransfer = amounts.length > 0 ? Math.max(...amounts) : 0;
  const pageLink = (cursor: string, direction: string) =>
    `/transfers?${new URLSearchParams({ filter: meta.filter, cursor, direction })}`;
  return (
    <AppPage breadcrumbs={[{ label: "Transfers" }]} headingId="transfers-title">
      <PageHeader
        description="Every native USDC transfer indexed on Base, newest first. Open one to see its parties and the rest of its transaction."
        id="transfers-title"
        stats={[
          { label: "Page total", unit: "USDC", value: fmtUSDC(pageTotal) },
          { label: "Average", unit: "USDC", value: fmtUSDC(averageTransfer) },
          { label: "Largest", unit: "USDC", value: fmtUSDC(largestTransfer) },
        ]}
        title="Transfers"
      />
      <Panel aria-busy={pending}>
        <PanelHead className="flex-wrap gap-3">
          <PanelTitle live={isLatestPage && connectionStatus === "live"}>Transfers</PanelTitle>
          <PanelActions>
            <nav aria-label="Transfer size">
              <ToggleGroup aria-label="Transfer size" type="single" value={meta.filter}>
                {(
                  [
                    ["all", "All"],
                    ["large", "≥ 10K"],
                    ["whale", "Whales"],
                  ] as const
                ).map(([filter, label]) => (
                  <ToggleGroupItem asChild key={filter} value={filter}>
                    <Link
                      aria-current={meta.filter === filter ? "page" : undefined}
                      to={`/transfers?filter=${filter}`}
                    >
                      {label}
                    </Link>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </nav>
          </PanelActions>
        </PanelHead>
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-2.5 font-mono text-2xs text-muted-foreground"
          role="status"
        >
          <span>
            {pending
              ? "Loading transfers…"
              : `${data.length} transfers · up to ${meta.limit} per page`}
          </span>
          {isLatestPage && <span>{liveTransferConnectionLabels[connectionStatus]}</span>}
          {meta.newerCursor && (
            <Link className="hover:text-accent" to={`/transfers?filter=${meta.filter}`}>
              Latest transfers ↗
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          {/* Fixed layout keeps columns from resizing as live rows with longer values arrive. */}
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]" scope="col">
                  Time (UTC)
                </TableHead>
                <TableHead scope="col">From</TableHead>
                <TableHead className="w-10" aria-label="Direction" scope="col" />
                <TableHead scope="col">To</TableHead>
                <TableHead className="w-[200px] text-right" scope="col">
                  Amount
                </TableHead>
                <TableHead className="w-[180px]" scope="col">
                  Transaction / log
                </TableHead>
                <TableHead className="w-10" aria-label="Details" scope="col" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((transfer) => (
                <TableRow
                  className="group cursor-pointer"
                  data-fresh={freshTransferIds.has(transfer.id) ? "true" : undefined}
                  key={transfer.id}
                  {...rowLink(getTransferPath(transfer.id))}
                >
                  <TableCell className="font-mono text-xs">
                    <time dateTime={transfer.blockTimestamp}>
                      {fmtUtcTimestamp(transfer.blockTimestamp)}
                    </time>
                    <span className="block text-muted-foreground">
                      Block {transfer.blockNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PartyCell party={transfer.from} />
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-flex size-6 items-center justify-center text-muted-foreground"
                      aria-hidden
                    >
                      <ArrowRight size={14} />
                    </span>
                  </TableCell>
                  <TableCell>
                    <PartyCell party={transfer.to} />
                  </TableCell>
                  <TableCell className="text-right" title={`${transfer.amount.formatted} USDC`}>
                    <Amount
                      value={getTransferAmount(transfer)}
                      magnitude={getTransferMagnitude(transfer)}
                      unit="USDC"
                    />
                  </TableCell>
                  <TableCell>
                    <a
                      className="font-mono text-xs text-accent"
                      title={transfer.transactionHash}
                      href={`https://basescan.org/tx/${transfer.transactionHash}#eventlog`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {transfer.transactionHash.slice(0, 10)}…{transfer.transactionHash.slice(-6)} ↗
                    </a>
                    <span className="block text-xs text-muted-foreground">
                      Log {transfer.logIndex}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <TransferRowLink transferId={transfer.id} />
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No indexed transfers match this page and filter. Try all transfers or return to
                    the latest page.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <nav
          aria-label="Transfer pagination"
          className="flex justify-between gap-3 border-t border-border px-3.5 py-2.5 font-mono text-xs"
        >
          {meta.newerCursor ? (
            <Link className="text-accent" to={pageLink(meta.newerCursor, "newer")}>
              ← Newer
            </Link>
          ) : (
            <span aria-disabled="true" className="text-muted-foreground">
              ← Newer
            </span>
          )}
          {olderCursor ? (
            <Link className="text-accent" to={pageLink(olderCursor, "older")}>
              Older →
            </Link>
          ) : (
            <span aria-disabled="true" className="text-muted-foreground">
              Older →
            </span>
          )}
        </nav>
      </Panel>
    </AppPage>
  );
}

// Live rows push older rows off the latest page, so page from the last visible row
// instead of the loader's cursor to avoid skipping the evicted rows.
function getOlderCursor({
  data,
  initialTransfers,
  isLatestPage,
  meta,
}: {
  data: LiveTransferRow[];
  initialTransfers: LiveTransferRow[];
  isLatestPage: boolean;
  meta: TransferListResponse["meta"];
}) {
  const last = data.at(-1);
  if (!isLatestPage || last === undefined) return meta.olderCursor;
  const visibleIds = new Set(data.map((transfer) => transfer.id));
  const hasEvictedRows = initialTransfers.some((transfer) => !visibleIds.has(transfer.id));
  if (meta.olderCursor === null && !hasEvictedRows) return null;
  return `${last.cursor.blockNumber}:${last.cursor.logIndex}`;
}

// One line for every party, labeled or not: a second line only on labeled rows made row heights
// differ, so the live table jumped as rows streamed in. A labeled entity shows its address
// inline; for an unlabeled wallet the chip already is the address.
function PartyCell({ party }: { party: LiveTransferParty }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0">
        <TransferEntity party={party} />
      </span>
      {party.isIdentified && (
        <a
          className="shrink-0 font-mono text-2xs text-muted-foreground hover:text-accent"
          href={`https://basescan.org/address/${party.address}`}
          rel="noreferrer"
          target="_blank"
          title={party.address}
        >
          {party.address.slice(0, 6)}…{party.address.slice(-4)} ↗
        </a>
      )}
    </span>
  );
}
