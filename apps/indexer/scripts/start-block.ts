/**
 * New deployments start 5 minutes of Base blocks before the archive's newest transfer:
 * at least one full minute of overlap, so the archive never needs the minute a new
 * deployment only partly saw, plus slack for archiver lag.
 */
export const archiveOverlapBlocks = 150n;

/**
 * A deployment never backfills more than 10 minutes of Base blocks. When the archive is
 * further behind (the indexer was down), the data in between is skipped: a gap is cheaper
 * than hours of RPC backfill and the database load that comes with it.
 */
export const maxBackfillBlocks = 300n;

export type StartBlockChoice = {
  source: "archive" | "head" | "initial";
  startBlock: bigint;
};

export const chooseStartBlock = ({
  archivedMaxBlock,
  headBlock,
  initialStartBlock,
}: {
  archivedMaxBlock: bigint | null;
  headBlock: bigint;
  initialStartBlock: bigint | undefined;
}): StartBlockChoice => {
  const earliestBlock = headBlock - maxBackfillBlocks;

  if (archivedMaxBlock !== null) {
    const afterArchive = archivedMaxBlock - archiveOverlapBlocks;
    return afterArchive >= earliestBlock
      ? { source: "archive", startBlock: afterArchive }
      : { source: "head", startBlock: earliestBlock };
  }

  if (initialStartBlock !== undefined) {
    return { source: "initial", startBlock: initialStartBlock };
  }

  return { source: "head", startBlock: earliestBlock };
};
