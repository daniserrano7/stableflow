import type { LiveTransferCursor, LiveTransferRow } from "@stableflow/shared";

export const mergeTransfers = (
  currentTransfers: LiveTransferRow[],
  nextTransfers: LiveTransferRow[],
) => {
  const transfersById = new Map<string, LiveTransferRow>();

  for (const transfer of [...currentTransfers, ...nextTransfers]) {
    transfersById.set(transfer.id, transfer);
  }

  return [...transfersById.values()].sort(compareTransfersNewestFirst);
};

export const compareTransfersNewestFirst = (a: LiveTransferRow, b: LiveTransferRow) => {
  const blockDelta = BigInt(b.blockNumber) - BigInt(a.blockNumber);

  if (blockDelta !== 0n) {
    return blockDelta > 0n ? 1 : -1;
  }

  return b.logIndex - a.logIndex;
};

export const getLatestTransferCursor = (
  transfers: LiveTransferRow[],
): LiveTransferCursor | null => {
  return [...transfers].sort(compareTransfersNewestFirst).at(0)?.cursor ?? null;
};

export const getNewestTransferCursor = (
  currentCursor: LiveTransferCursor | null,
  nextCursor: LiveTransferCursor | null,
) => {
  if (currentCursor === null || nextCursor === null) {
    return nextCursor ?? currentCursor;
  }

  const currentBlockNumber = BigInt(currentCursor.blockNumber);
  const nextBlockNumber = BigInt(nextCursor.blockNumber);

  if (nextBlockNumber > currentBlockNumber) {
    return nextCursor;
  }

  if (nextBlockNumber === currentBlockNumber && nextCursor.logIndex > currentCursor.logIndex) {
    return nextCursor;
  }

  return currentCursor;
};
