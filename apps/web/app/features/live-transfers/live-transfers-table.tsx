import type { LiveTransferParty, LiveTransferRow } from "@stableflow/shared";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { Link } from "react-router";
import { Amount, Entity, Panel, PanelActions, PanelHead, PanelTitle, Tag } from "~/components";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useRowLink } from "~/hooks/use-row-link";
import { getTransferPath, TransferRowLink } from "../transfers/transfer-link";
import {
  getEntityGlyph,
  getPartyCategory,
  getTransferAmount,
  getTransferCategory,
  getTransferMagnitude,
  isTransferFilter,
  type TransferFilter,
  transferFilterOptions,
} from "./live-transfers.utils";
import {
  type LiveTransferConnectionStatus,
  liveTransferConnectionLabels,
} from "./use-live-transfers";

interface LiveTransfersTableProps {
  bufferedCount: number;
  connectionStatus: LiveTransferConnectionStatus;
  filter: TransferFilter;
  freshTransferIds: ReadonlySet<string>;
  matchingCount: number;
  onFilterChange: (filter: TransferFilter) => void;
  transfers: LiveTransferRow[];
}

export function LiveTransfersTable({
  bufferedCount,
  connectionStatus,
  filter,
  freshTransferIds,
  matchingCount,
  onFilterChange,
  transfers,
}: LiveTransfersTableProps) {
  const rowLink = useRowLink();

  return (
    <Panel className="min-h-0 flex-1">
      <PanelHead className="flex-wrap gap-2">
        <PanelTitle live={connectionStatus === "live"}>Live Transfers</PanelTitle>
        <PanelActions className="items-center">
          <span role="status" className="font-mono text-2xs text-muted-foreground">
            {liveTransferConnectionLabels[connectionStatus]}
          </span>
          <ToggleGroup
            aria-label="Transfer filter"
            type="single"
            value={filter}
            onValueChange={(nextFilter) => {
              if (isTransferFilter(nextFilter)) {
                onFilterChange(nextFilter);
              }
            }}
          >
            {transferFilterOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PanelActions>
      </PanelHead>

      <div className="overflow-x-auto">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%]" scope="col">
                From
              </TableHead>
              <TableHead className="w-8" aria-label="Direction" scope="col" />
              <TableHead className="w-[32%]" scope="col">
                To
              </TableHead>
              <TableHead className="w-[20%] text-right" scope="col">
                Amount
              </TableHead>
              <TableHead className="w-[16%] text-right" scope="col">
                Protocol
              </TableHead>
              <TableHead className="w-10" aria-label="Details" scope="col" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => (
              <TableRow
                // Fixed height: rows with a protocol tag are otherwise 2px taller than rows with
                // the "—" placeholder, and the live feed visibly jitters as they stream in.
                className="group h-10 cursor-pointer"
                data-fresh={freshTransferIds.has(transfer.id) ? "true" : undefined}
                key={transfer.id}
                {...rowLink(getTransferPath(transfer.id))}
              >
                <TableCell>
                  <TransferEntity party={transfer.from} />
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
                </TableCell>
                <TableCell className="text-right">
                  <Amount
                    value={getTransferAmount(transfer)}
                    magnitude={getTransferMagnitude(transfer)}
                    unit={transfer.amount.currency}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <ProtocolTag category={getTransferCategory(transfer)} />
                </TableCell>
                <TableCell className="text-right">
                  <TransferRowLink transferId={transfer.id} />
                </TableCell>
              </TableRow>
            ))}
            {transfers.length === 0 && (
              <TableRow>
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={6}>
                  No transfers match this filter yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3 border-border border-t px-3.5 py-2.5 font-mono text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CircleDollarSign size={13} /> {transfers.length} shown
        </span>
        <Link className="hover:text-accent" to={`/transfers?filter=${filter}`}>
          View all transfers →
        </Link>
        <span>
          {matchingCount} matching · {bufferedCount} buffered
        </span>
      </div>
    </Panel>
  );
}

// Wallet-to-wallet is the default case; a tag on every such row is noise that buries the
// rows where a protocol is actually involved.
function ProtocolTag({ category }: { category: ReturnType<typeof getTransferCategory> }) {
  if (category === "wallet") {
    return (
      <span className="text-muted-foreground/60" title="No labeled protocol">
        —
      </span>
    );
  }
  return <Tag category={category} />;
}

export function TransferEntity({ party }: { party: LiveTransferParty }) {
  const category = getPartyCategory(party);
  const entity = (
    <Entity
      address={party.address}
      category={category}
      className="max-w-full"
      entityId={party.entityId}
      glyph={getEntityGlyph(party, category)}
      isWallet={!party.isIdentified}
      name={party.displayName}
    />
  );

  if (party.entityId === null) {
    return entity;
  }

  return (
    <Link
      className="text-foreground no-underline hover:text-accent"
      to={`/entities/${party.entityId}`}
    >
      {entity}
    </Link>
  );
}
