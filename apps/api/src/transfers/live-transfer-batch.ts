import type { LiveTransferBatchEvent, TransferFilter } from "@stableflow/shared";
import { transferThresholds } from "@stableflow/shared";

interface OrderedTransferRecord {
  blockNumber: bigint;
  id: string;
  logIndex: number;
}

/** Merges query results into one oldest-first list without duplicates. */
export const combineLiveTransferRecords = <Record extends OrderedTransferRecord>(
  ...groups: Record[][]
): Record[] => {
  const recordsById = new Map<string, Record>();

  for (const group of groups) {
    for (const record of group) {
      recordsById.set(record.id, record);
    }
  }

  return [...recordsById.values()].sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex - b.logIndex
      : a.blockNumber < b.blockNumber
        ? -1
        : 1,
  );
};

export const getTransferFilterMinimum = (filter: TransferFilter) =>
  BigInt(transferThresholds[filter]) * 1_000_000n;

/** Keeps the batch cursor so a filtered subscriber still resumes from the newest poll. */
export const filterLiveTransferBatch = (
  batch: LiveTransferBatchEvent,
  filter: TransferFilter,
): LiveTransferBatchEvent => {
  if (filter === "all") return batch;

  const minimum = getTransferFilterMinimum(filter);

  return {
    ...batch,
    transfers: batch.transfers.filter((transfer) => BigInt(transfer.amount.raw) >= minimum),
  };
};
