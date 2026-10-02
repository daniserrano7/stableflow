/**
 * New deployments start 5 minutes of Base blocks before the archive's newest transfer:
 * at least one full minute of overlap, so the archive never needs the minute a new
 * deployment only partly saw, plus slack for archiver lag.
 */
export const archiveOverlapBlocks = 150n;

export type StartBlockChoice = {
  source: "archive" | "initial";
  startBlock: bigint;
};

export const chooseStartBlock = ({
  archivedMaxBlock,
  initialStartBlock,
}: {
  archivedMaxBlock: bigint | null;
  initialStartBlock: bigint | undefined;
}): StartBlockChoice => {
  if (archivedMaxBlock !== null) {
    return { source: "archive", startBlock: archivedMaxBlock - archiveOverlapBlocks };
  }

  if (initialStartBlock === undefined) {
    throw new Error("PONDER_DISCOVERY_START_BLOCK_8453 is required until the archive has data");
  }

  return { source: "initial", startBlock: initialStartBlock };
};
