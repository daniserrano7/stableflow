import type { LiveTransferParty, LiveTransferRow } from "@stableflow/shared";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import {
  Amount,
  Entity,
  Panel,
  PanelActions,
  PanelHead,
  PanelTitle,
  Segmented,
  Tag,
} from "../design-system/components";
import type { Category } from "../design-system/tokens";

const categoryLabels: Record<string, Category> = {
  bridge: "bridge",
  cex: "cex",
  dex: "dex",
  lending: "lending",
  mint: "mint",
  wallet: "wallet",
};

export type TransferFilter = "all" | "large" | "whale";

const filterOptions: { label: string; value: TransferFilter }[] = [
  { label: "All", value: "all" },
  { label: ">= $10K", value: "large" },
  { label: "Whales", value: "whale" },
];

interface LiveTransfersTableProps {
  bufferedCount: number;
  filter: TransferFilter;
  onFilterChange: (filter: TransferFilter) => void;
  transfers: LiveTransferRow[];
}

export function LiveTransfersTable({
  bufferedCount,
  filter,
  onFilterChange,
  transfers,
}: LiveTransfersTableProps) {
  return (
    <Panel className="min-h-0 flex-1">
      <PanelHead>
        <PanelTitle live>Live Transfers</PanelTitle>
        <PanelActions>
          <Segmented value={filter} onChange={onFilterChange} options={filterOptions} />
        </PanelActions>
      </PanelHead>

      <div className="overflow-x-auto">
        <table className="sf-table min-w-[820px]">
          <thead>
            <tr>
              <th className="w-[32%]" scope="col">
                From
              </th>
              <th className="w-8" aria-label="Direction" scope="col" />
              <th className="w-[32%]" scope="col">
                To
              </th>
              <th className="w-[20%] text-right" scope="col">
                Amount
              </th>
              <th className="w-[16%] text-right" scope="col">
                Protocol
              </th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer, index) => (
              <tr data-fresh={index === 0 ? "true" : undefined} key={transfer.id}>
                <td>
                  <TransferEntity party={transfer.from} />
                </td>
                <td>
                  <span
                    className="inline-flex size-6 items-center justify-center text-muted-foreground"
                    aria-hidden
                  >
                    <ArrowRight size={14} />
                  </span>
                </td>
                <td>
                  <TransferEntity party={transfer.to} />
                </td>
                <td className="text-right">
                  <Amount
                    value={getTransferAmount(transfer)}
                    magnitude={getTransferMagnitude(transfer)}
                    unit={transfer.amount.currency}
                  />
                </td>
                <td className="text-right">
                  <Tag category={getTransferCategory(transfer)} />
                </td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td className="h-32 text-center text-muted-foreground" colSpan={5}>
                  No transfers match this filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-border border-t px-3.5 py-2.5 font-mono text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CircleDollarSign size={13} /> {transfers.length} visible
        </span>
        <span>{bufferedCount} buffered</span>
      </div>
    </Panel>
  );
}

export function getTransferAmount(transfer: LiveTransferRow) {
  return Number.parseFloat(transfer.amount.formatted.replaceAll(",", ""));
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

function getPartyCategory(party: LiveTransferParty): Category {
  if (!party.isIdentified) {
    return "wallet";
  }

  return categoryLabels[party.category.toLowerCase()] ?? "wallet";
}

function getTransferCategory(transfer: LiveTransferRow): Category {
  const toCategory = getPartyCategory(transfer.to);

  if (toCategory !== "wallet") {
    return toCategory;
  }

  return getPartyCategory(transfer.from);
}

function getEntityGlyph(party: LiveTransferParty, category: Category) {
  if (!party.isIdentified) {
    return "0x";
  }

  const source = party.entityName ?? party.displayName;
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");

  return initials || category.slice(0, 2).toUpperCase();
}

function getTransferMagnitude(transfer: LiveTransferRow) {
  const amount = getTransferAmount(transfer);

  if (amount >= 1_000_000) {
    return "whale";
  }

  if (amount >= 10_000) {
    return "large";
  }

  return "small";
}
