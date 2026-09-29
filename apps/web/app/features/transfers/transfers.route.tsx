import {
  type LiveTransferRow,
  parseTransferListParams,
  type TransferListResponse,
} from "@stableflow/shared";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import { Link, useLoaderData, useNavigation } from "react-router";
import { Amount, KPI, Panel, PanelActions, PanelBody, PanelHead, PanelTitle } from "~/components";
import { PublicPage } from "~/components/public-page";
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
import { getTransferAmount, getTransferMagnitude } from "../live-transfers/live-transfers.utils";
import { TransferEntity } from "../live-transfers/live-transfers-table";
import {
  liveTransferConnectionLabels,
  useLiveTransfers,
} from "../live-transfers/use-live-transfers";
import { getTransferPath, TransferRowLink } from "./transfer-link";

export function meta() {
  return [
    { title: "Transfers | Stableflow" },
    {
      name: "description",
      content: "Explore indexed USDC transfers on Base, including large and whale transfers.",
    },
  ];
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
    <PublicPage title="Transfers">
      <Panel>
        <PanelBody className="flex flex-col items-start gap-5 p-5 sm:flex-row">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-accent text-background shadow-[var(--shadow-glow-accent)]">
            <ArrowLeftRight size={25} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
              Onchain transfers · Base · USDC
            </p>
            <h1 className="m-0 text-2xl font-medium leading-tight">Transfer History</h1>
          </div>
        </PanelBody>
      </Panel>
      <section
        aria-label="Current transfer page summary"
        className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KPI label="Transfers shown" value={data.length} unit={`/ ${meta.limit} max`} />
        <KPI label="Page total" value={fmtUSDC(pageTotal)} unit="USDC" />
        <KPI label="Average transfer" value={fmtUSDC(averageTransfer)} unit="USDC" />
        <KPI label="Largest transfer" value={fmtUSDC(largestTransfer)} unit="USDC" />
      </section>
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
                    <TransferEntity party={transfer.from} />
                    <a
                      className="mt-1 block font-mono text-2xs text-muted-foreground hover:text-accent"
                      href={`https://basescan.org/address/${transfer.from.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title={transfer.from.address}
                    >
                      {transfer.from.address.slice(0, 8)}…{transfer.from.address.slice(-6)} ↗
                    </a>
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
                    <TransferEntity party={transfer.to} />
                    <a
                      className="mt-1 block font-mono text-2xs text-muted-foreground hover:text-accent"
                      href={`https://basescan.org/address/${transfer.to.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title={transfer.to.address}
                    >
                      {transfer.to.address.slice(0, 8)}…{transfer.to.address.slice(-6)} ↗
                    </a>
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
    </PublicPage>
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
