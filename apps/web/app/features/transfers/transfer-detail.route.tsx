import {
  type LiveTransferParty,
  type LiveTransferRow,
  parseTransferId,
  type TransferDetailResponse,
} from "@stableflow/shared";
import { ArrowDown, ArrowRight, ExternalLink, Layers, Receipt } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, redirect, useLoaderData } from "react-router";
import { Amount, CopyButton, Panel, PanelHead, PanelTitle, Tag, VisualMark } from "~/components";
import { AppPage } from "~/components/app-page";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getApiUrl } from "~/config/api.server";
import { getVisualIdentity } from "~/config/visuals";
import { useRowLink } from "~/hooks/use-row-link";
import { getAddressAvatarBackground } from "~/utils/address-avatar";
import { cn } from "~/utils/cn";
import { fmtTokenAmount, fmtUSDC, fmtUtcTimestamp, timeAgo } from "~/utils/format";
import {
  getEntityGlyph,
  getPartyCategory,
  getTransferAmount,
  getTransferMagnitude,
} from "../live-transfers/live-transfers.utils";
import { TransferEntity } from "../live-transfers/live-transfers-table";
import { getTransferPath, TransferRowLink } from "./transfer-link";

const basescanUrl = "https://basescan.org";
const relativeTimeRefreshMs = 30_000;

type TransactionSummary = TransferDetailResponse["data"]["transaction"];

export function meta({ data }: { data?: TransferDetailResponse }) {
  const transfer = data?.data.transfer;
  return [
    {
      title: transfer
        ? `${fmtTokenAmount(transfer.amount.formatted)} USDC transfer | Stableflow`
        : "Transfer | Stableflow",
    },
    {
      name: "description",
      content: transfer
        ? `USDC transfer from ${transfer.from.displayName} to ${transfer.to.displayName} on Base.`
        : "USDC transfer detail on Base.",
    },
  ];
}

export async function loader({
  params,
  request,
}: {
  params: { transferId?: string };
  request: Request;
}): Promise<TransferDetailResponse> {
  const parsed = parseTransferId(params.transferId ?? "");
  if (parsed === null) throw new Response("Transfer not found", { status: 404 });

  const response = await fetch(getApiUrl(`/transfers/${parsed.id}`), {
    headers: { accept: "application/json" },
    signal: request.signal,
  });
  // Raw transfers are kept for 14 days; older ones are only on Basescan.
  if (response.status === 404) throw redirect(`${basescanUrl}/tx/${parsed.transactionHash}`);
  if (!response.ok) throw new Response("Unable to load transfer", { status: response.status });
  return response.json();
}

export default function TransferDetail() {
  const { data, meta } = useLoaderData<typeof loader>();
  const { transaction, transfer } = data;

  return (
    <AppPage
      breadcrumbs={[
        { label: "Transfers", to: "/transfers" },
        { label: `${shortHex(transfer.transactionHash)} · log ${transfer.logIndex}` },
      ]}
      headingId="transfer-title"
    >
      <TransferHero transfer={transfer} />
      {/* Same layout for every transfer; the transaction list is context for this one. */}
      <div className="grid gap-3.5 xl:grid-cols-2">
        <TransferDetails
          chainId={meta.chainId}
          tokenAddress={meta.tokenAddress}
          transfer={transfer}
        />
        <TransactionTransfers transaction={transaction} transferId={transfer.id} />
      </div>
    </AppPage>
  );
}

function TransferHero({ transfer }: { transfer: LiveTransferRow }) {
  const magnitude = getTransferMagnitude(transfer);
  const relativeTime = useRelativeTime(transfer.blockTimestamp);

  return (
    <Panel>
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          {/* min-h fits the size badge, so the row is as tall with or without it: no shift when
              moving between a small transfer and a ≥ 10K one. */}
          <p className="mb-2 flex min-h-6 flex-wrap items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
            <span>Transfer · Base · USDC</span>
            {magnitude !== "small" && <Tag>{magnitude === "whale" ? "Whale" : "≥ 10K"}</Tag>}
          </p>
          {/* Exact amount: the compact table format would round small transfers to 0. */}
          <h1
            id="transfer-title"
            className={cn(
              "m-0 break-all font-mono text-3xl font-medium leading-tight tabular-nums",
              magnitude === "whale" && "text-whale",
              magnitude === "large" && "text-magnitude-large",
            )}
          >
            {fmtTokenAmount(transfer.amount.formatted)}
            {/* The space lives inside the small span: screen readers get "… USDC" while the
                visual gap stays at unit size rather than a full display-size space. */}
            <span className="ml-1.5 text-sm text-muted-foreground">{" USDC"}</span>
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            <time dateTime={transfer.blockTimestamp}>
              {fmtUtcTimestamp(transfer.blockTimestamp)} UTC
            </time>
            {relativeTime && ` · ${relativeTime}`}
          </p>
        </div>
        <Button asChild className="self-start lg:self-center" size="sm" variant="secondary">
          <a
            href={`${basescanUrl}/tx/${transfer.transactionHash}#eventlog`}
            rel="noreferrer"
            target="_blank"
          >
            View on Basescan <ExternalLink />
          </a>
        </Button>
      </div>

      <section
        aria-label="Transfer route"
        className="grid border-border border-t xl:grid-cols-[minmax(0,1fr)_0_minmax(0,1fr)]"
      >
        <PartyBlock label="From" party={transfer.from} />
        {/* Zero-width track: the divider sits on the column seam and the arrow straddles it. */}
        <div
          aria-hidden
          className="relative flex h-0 items-center justify-center border-border border-t xl:h-auto xl:border-t-0 xl:border-l"
        >
          <span className="absolute flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <ArrowDown className="xl:hidden" size={14} />
            <ArrowRight className="hidden xl:block" size={14} />
          </span>
        </div>
        <PartyBlock label="To" party={transfer.to} />
      </section>
    </Panel>
  );
}

function PartyBlock({ label, party }: { label: "From" | "To"; party: LiveTransferParty }) {
  const category = getPartyCategory(party);
  const visual = party.entityId ? getVisualIdentity("entity", party.entityId) : undefined;
  const addressLabel = `${label === "From" ? "sender" : "receiver"} address`;

  return (
    <div className="flex min-w-0 flex-col gap-4 p-5 xl:px-7">
      <div className="flex items-center gap-3">
        <VisualMark
          className={cn(
            "size-10 font-mono text-sm font-semibold text-[oklch(0.13_0.012_254)]",
            party.isIdentified ? "rounded-lg" : "rounded-full",
          )}
          fallback={party.isIdentified ? getEntityGlyph(party, category) : null}
          imageName={visual?.name}
          imageUrl={visual?.imageUrl}
          style={{
            background: party.isIdentified
              ? `var(--cat-${category})`
              : getAddressAvatarBackground(party.address),
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="m-0 font-mono text-2xs text-muted-foreground uppercase tracking-[0.08em]">
            {label}
          </p>
          <p className="m-0 mt-0.5 truncate text-md font-medium">
            {party.entityId !== null ? (
              <Link
                className="text-foreground hover:text-accent"
                to={`/entities/${party.entityId}`}
              >
                {party.displayName}
              </Link>
            ) : (
              <span className="text-muted-foreground">Unlabeled wallet</span>
            )}
          </p>
        </div>
        {party.isIdentified && <Tag category={category} />}
      </div>

      <div className="flex items-center gap-1 rounded-md bg-surface-2 py-1 pr-1 pl-3">
        <span className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">
          {party.address}
        </span>
        <CopyButton label={addressLabel} value={party.address} />
        <Button asChild size="icon-sm" variant="ghost">
          <a
            aria-label={`Open ${addressLabel} on Basescan`}
            href={`${basescanUrl}/address/${party.address}`}
            rel="noreferrer"
            target="_blank"
            title="Open on Basescan"
          >
            <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  );
}

function TransferDetails({
  chainId,
  tokenAddress,
  transfer,
}: {
  chainId: number;
  tokenAddress: string;
  transfer: LiveTransferRow;
}) {
  return (
    <Panel className="flex flex-col">
      <PanelHead>
        <PanelTitle>
          <Receipt size={14} />
          Transfer Details
        </PanelTitle>
      </PanelHead>
      <dl className="m-0 flex-1 font-mono text-xs">
        <DetailRow copyLabel="transfer ID" copyValue={transfer.id} label="Transfer ID">
          {/* Middle-truncated so it never wraps a stray character; copy and hover give the full ID. */}
          <span title={transfer.id}>
            {shortHex(transfer.transactionHash)}-{transfer.logIndex}
          </span>
        </DetailRow>
        <DetailRow copyLabel="raw value" copyValue={transfer.amount.raw} label="Raw value">
          {transfer.amount.raw} <span className="text-muted-foreground">(6 decimals)</span>
        </DetailRow>
        <DetailRow label="Token">
          <ExternalValue href={`${basescanUrl}/token/${tokenAddress}`}>
            USDC · {tokenAddress}
          </ExternalValue>
        </DetailRow>
        <DetailRow label="Network">Base · chain {chainId}</DetailRow>
        <DetailRow
          copyLabel="transaction hash"
          copyValue={transfer.transactionHash}
          label="Transaction"
        >
          <ExternalValue href={`${basescanUrl}/tx/${transfer.transactionHash}`}>
            {transfer.transactionHash}
          </ExternalValue>
        </DetailRow>
        <DetailRow label="Log index">{transfer.logIndex}</DetailRow>
        <DetailRow copyLabel="block number" copyValue={transfer.blockNumber} label="Block">
          <ExternalValue href={`${basescanUrl}/block/${transfer.blockNumber}`}>
            {Number(transfer.blockNumber).toLocaleString("en-US")}
          </ExternalValue>
        </DetailRow>
        <DetailRow label="Timestamp">
          <time dateTime={transfer.blockTimestamp}>
            {fmtUtcTimestamp(transfer.blockTimestamp)} UTC
          </time>
        </DetailRow>
      </dl>
      <p className="m-0 px-4 py-3 text-xs text-muted-foreground">
        Entity labels are attributed from registered and discovered addresses.{" "}
        <Link className="text-accent" to="/methodology#labels">
          How attribution works →
        </Link>
      </p>
    </Panel>
  );
}

function DetailRow({
  children,
  copyLabel,
  copyValue,
  label,
}: {
  children: ReactNode;
  copyLabel?: string;
  copyValue?: string;
  label: string;
}) {
  // min-h keeps rows even whether or not they carry a copy button.
  return (
    <div className="grid min-h-11 grid-cols-[7rem_minmax(0,1fr)_1.75rem] items-center gap-3 border-border border-b px-4 py-1.5">
      <dt className="text-2xs text-muted-foreground uppercase tracking-[0.06em]">{label}</dt>
      <dd className="m-0 min-w-0 break-all text-foreground">{children}</dd>
      {copyValue !== undefined && copyLabel !== undefined ? (
        <CopyButton label={copyLabel} value={copyValue} />
      ) : (
        <span />
      )}
    </div>
  );
}

function ExternalValue({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="text-foreground hover:text-accent" href={href} rel="noreferrer" target="_blank">
      {children} <ExternalLink className="inline" size={11} />
    </a>
  );
}

function TransactionTransfers({
  transaction,
  transferId,
}: {
  transaction: TransactionSummary;
  transferId: string;
}) {
  const rowLink = useRowLink();
  const { transferCount } = transaction;
  const listed = transaction.transfers.length;

  return (
    <Panel className="flex flex-col">
      <PanelHead>
        <PanelTitle>
          <Layers size={14} />
          Transfers in This Transaction
        </PanelTitle>
        <span className="font-mono text-2xs text-muted-foreground">
          {transferCount} transfer{transferCount === 1 ? "" : "s"}
        </span>
      </PanelHead>
      <p className="m-0 border-border border-b px-4 py-3 text-xs text-muted-foreground">
        {transferCount === 1
          ? "This is the only USDC transfer in its transaction."
          : `The transaction emitted ${transferCount} USDC transfers. The highlighted row is the one you are viewing; select another to open it.`}
      </p>
      <dl className="m-0 grid grid-cols-2 divide-x divide-border border-border border-b">
        <TransactionStat label="Transfers" value={`${transferCount}`} />
        <TransactionStat
          hint="Each address's net change, so USDC passing through a router or pool counts once."
          label="Net value moved"
          value={`${fmtUSDC(Number(transaction.adjustedValue.formatted))} USDC`}
        />
      </dl>
      <div className="overflow-x-auto">
        <Table className="min-w-[560px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" scope="col">
                Log
              </TableHead>
              <TableHead scope="col">From</TableHead>
              <TableHead scope="col">To</TableHead>
              <TableHead className="w-[132px] text-right" scope="col">
                Amount
              </TableHead>
              <TableHead className="w-24" aria-label="Details" scope="col" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transaction.transfers.map((transfer) => {
              const isCurrent = transfer.id === transferId;
              return (
                <TableRow
                  aria-current={isCurrent ? "page" : undefined}
                  className={
                    isCurrent
                      ? "bg-accent/5 shadow-[inset_2px_0_0_var(--accent)] hover:bg-accent/5"
                      : "group cursor-pointer"
                  }
                  key={transfer.id}
                  {...(isCurrent ? {} : rowLink(getTransferPath(transfer.id)))}
                >
                  <TableCell
                    className={cn("text-xs", isCurrent ? "text-accent" : "text-muted-foreground")}
                  >
                    {transfer.logIndex}
                  </TableCell>
                  <TableCell className="min-w-0">
                    <TransferEntity party={transfer.from} />
                  </TableCell>
                  <TableCell className="min-w-0">
                    <TransferEntity party={transfer.to} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Amount
                      magnitude={getTransferMagnitude(transfer)}
                      unit="USDC"
                      value={getTransferAmount(transfer)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {isCurrent ? (
                      <Tag className="border-accent/40 text-accent">Viewing</Tag>
                    ) : (
                      <TransferRowLink transferId={transfer.id} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="m-0 mt-auto border-border border-t px-4 py-3 text-xs text-muted-foreground">
        {listed < transferCount ? (
          <>
            Showing the first {listed} of {transferCount} transfers.{" "}
            <a
              className="text-accent"
              href={`${basescanUrl}/tx/${transaction.hash}#eventlog`}
              rel="noreferrer"
              target="_blank"
            >
              See all on Basescan ↗
            </a>
          </>
        ) : (
          "One transaction can emit several transfers, for example the hops of a swap or a batch payout."
        )}
      </p>
    </Panel>
  );
}

function TransactionStat({ hint, label, value }: { hint?: string; label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3" title={hint}>
      <dt className="truncate font-mono text-2xs text-muted-foreground uppercase tracking-[0.06em]">
        {label}
      </dt>
      <dd className="m-0 mt-1 font-mono text-md tabular-nums">{value}</dd>
    </div>
  );
}

// Relative time depends on the viewer's clock, so it renders after hydration only.
function useRelativeTime(iso: string) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), relativeTimeRefreshMs);
    return () => window.clearInterval(interval);
  }, []);

  return now === null ? null : timeAgo(Date.parse(iso), now);
}

const shortHex = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;
