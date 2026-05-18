import type { LiveTransferParty, LiveTransferRow } from "@stableflow/shared";
import { ArrowRight, CircleDollarSign } from "lucide-react";
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
import {
  getEntityGlyph,
  getPartyCategory,
  getTransferAmount,
  getTransferCategory,
  getTransferMagnitude,
  isTransferFilter,
  transferFilterOptions,
  type TransferFilter,
} from "./live-transfers.utils";

interface LiveTransfersTableProps {
  bufferedCount: number;
  filter: TransferFilter;
  freshTransferIds: ReadonlySet<string>;
  matchingCount: number;
  onFilterChange: (filter: TransferFilter) => void;
  transfers: LiveTransferRow[];
}

export function LiveTransfersTable({
  bufferedCount,
  filter,
  freshTransferIds,
  matchingCount,
  onFilterChange,
  transfers,
}: LiveTransfersTableProps) {
  return (
    <Panel className="min-h-0 flex-1">
      <PanelHead>
        <PanelTitle live>Live Transfers</PanelTitle>
        <PanelActions>
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
        <Table className="sf-table min-w-[820px]">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => (
              <TableRow
                data-fresh={freshTransferIds.has(transfer.id) ? "true" : undefined}
                key={transfer.id}
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
                  <Tag category={getTransferCategory(transfer)} />
                </TableCell>
              </TableRow>
            ))}
            {transfers.length === 0 && (
              <TableRow>
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={5}>
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
        <span>
          {matchingCount} matching · {bufferedCount} buffered
        </span>
      </div>
    </Panel>
  );
}

function TransferEntity({ party }: { party: LiveTransferParty }) {
  const category = getPartyCategory(party);

  return (
    <Entity
      category={category}
      glyph={getEntityGlyph(party, category)}
      isWallet={!party.isIdentified}
      name={party.displayName}
    />
  );
}
