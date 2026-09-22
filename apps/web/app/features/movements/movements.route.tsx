import { type MovementsResponse, parseMovementParams } from "@stableflow/shared";
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
import { fmtUSDC } from "~/utils/format";
import { getTransferAmount, getTransferMagnitude } from "../live-transfers/live-transfers.utils";
import { TransferEntity } from "../live-transfers/live-transfers-table";

export function meta() {
  return [
    { title: "Movements | Stableflow" },
    {
      name: "description",
      content: "Explore indexed USDC transfers on Base, including large and whale movements.",
    },
  ];
}

export async function loader({ request }: { request: Request }): Promise<MovementsResponse> {
  const params = new URL(request.url).searchParams;
  try {
    parseMovementParams(params);
  } catch (error) {
    throw new Response(error instanceof Error ? error.message : "Invalid movement parameters", {
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
  if (!response.ok) throw new Response("Unable to load movements", { status: response.status });
  return response.json();
}

export default function Movements() {
  const { data, meta } = useLoaderData<typeof loader>();
  const pending = useNavigation().state !== "idle";
  const amounts = data.map(getTransferAmount);
  const pageVolume = amounts.reduce((total, amount) => total + amount, 0);
  const averageMovement = data.length > 0 ? pageVolume / data.length : 0;
  const largestMovement = amounts.length > 0 ? Math.max(...amounts) : 0;
  const pageLink = (cursor: string, direction: string) =>
    `/movements?${new URLSearchParams({ filter: meta.filter, cursor, direction })}`;
  return (
    <PublicPage title="Movements">
      <Panel>
        <PanelBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Browse indexed native USDC transfers on Base, newest first. Each row is one transfer
            event; a transaction can contain several movements.
          </p>
          <p className="text-xs text-muted-foreground">
            Large includes whale transfers. This raw feed includes internal transfers and mint/burn
            events; it is not net entity flow.{" "}
            <Link className="text-accent" to="/methodology#counting">
              How counting works →
            </Link>
          </p>
        </PanelBody>
      </Panel>
      <section
        aria-label="Current movement page summary"
        className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KPI label="Movements shown" value={data.length} unit={`/ ${meta.limit} max`} />
        <KPI label="Page volume" value={fmtUSDC(pageVolume)} unit="USDC" />
        <KPI label="Average movement" value={fmtUSDC(averageMovement)} unit="USDC" />
        <KPI label="Largest movement" value={fmtUSDC(largestMovement)} unit="USDC" />
      </section>
      <Panel aria-busy={pending}>
        <PanelHead className="flex-wrap gap-3">
          <PanelTitle>Movements</PanelTitle>
          <PanelActions>
            <nav aria-label="Movement size">
              <ToggleGroup aria-label="Movement size" type="single" value={meta.filter}>
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
                      to={`/movements?filter=${filter}`}
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
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3.5 text-xs text-muted-foreground"
          role="status"
        >
          <span>
            {pending
              ? "Loading movements…"
              : `${data.length} movements · up to ${meta.limit} per page`}
          </span>
          <Link className="hover:text-accent" to={`/movements?filter=${meta.filter}`}>
            Latest movements ↗
          </Link>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead>Time (UTC)</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Transaction / log</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="font-mono text-xs">
                    <time dateTime={transfer.blockTimestamp}>
                      {transfer.blockTimestamp.replace("T", " ").replace(".000Z", "")}
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
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No indexed movements match this page and filter. Try all movements or return to
                    the latest page.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <nav
          aria-label="Movement pagination"
          className="flex justify-between gap-3 border-t border-border p-3.5 text-sm"
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
          {meta.olderCursor ? (
            <Link className="text-accent" to={pageLink(meta.olderCursor, "older")}>
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
