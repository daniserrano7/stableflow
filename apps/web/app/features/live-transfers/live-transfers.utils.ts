import {
  type LiveTransferParty,
  type LiveTransferRow,
  movementThresholds,
} from "@stableflow/shared";
import type { Category } from "~/styles/tokens";

export type TransferFilter = "all" | "large" | "whale";

export const largeTransferThreshold = movementThresholds.large;
export const whaleThreshold = movementThresholds.whale;

export const transferFilterOptions: { label: string; value: TransferFilter }[] = [
  { label: "All", value: "all" },
  { label: ">= $10K", value: "large" },
  { label: "Whales", value: "whale" },
];

const categoryLabels: Record<string, Category> = {
  bridge: "bridge",
  cex: "cex",
  dex: "dex",
  lending: "lending",
  mint: "mint",
  wallet: "wallet",
};

export function getTransferAmount(transfer: LiveTransferRow) {
  const amount = Number.parseFloat(transfer.amount.formatted.replaceAll(",", ""));

  return Number.isFinite(amount) ? amount : 0;
}

export function getPartyCategory(party: LiveTransferParty): Category {
  if (!party.isIdentified) {
    return "wallet";
  }

  return categoryLabels[party.category.toLowerCase()] ?? "wallet";
}

export function getTransferCategory(transfer: LiveTransferRow): Category {
  const toCategory = getPartyCategory(transfer.to);

  if (toCategory !== "wallet") {
    return toCategory;
  }

  return getPartyCategory(transfer.from);
}

export function getEntityGlyph(party: LiveTransferParty, category = getPartyCategory(party)) {
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

export function getTransferMagnitude(transfer: LiveTransferRow) {
  const amount = getTransferAmount(transfer);

  if (amount >= whaleThreshold) {
    return "whale";
  }

  if (amount >= largeTransferThreshold) {
    return "large";
  }

  return "small";
}

export function transferMatchesFilter(transfer: LiveTransferRow, filter: TransferFilter) {
  const amount = getTransferAmount(transfer);

  if (filter === "whale") {
    return amount >= whaleThreshold;
  }

  if (filter === "large") {
    return amount >= largeTransferThreshold;
  }

  return true;
}

export function isTransferFilter(value: string): value is TransferFilter {
  return value === "all" || value === "large" || value === "whale";
}
