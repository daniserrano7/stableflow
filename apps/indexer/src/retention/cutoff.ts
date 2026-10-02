/**
 * The archive copies a minute's bucket again until a minute after it settles, so pruning
 * stays this far behind the newest archived block.
 */
export const archiveSettleSeconds = 120n;

/**
 * Rows older than the returned block time can be pruned from the live tables: past the
 * retention window and already in the archive. Null means prune nothing (empty archive).
 */
export const getLiveRetentionCutoff = ({
  archivedThroughTimestamp,
  blockTimestamp,
  retentionSeconds,
}: {
  archivedThroughTimestamp: bigint | null;
  blockTimestamp: bigint;
  retentionSeconds: bigint;
}) => {
  if (archivedThroughTimestamp === null) return null;

  const retentionCutoff = blockTimestamp - retentionSeconds;
  const archivedCutoff = archivedThroughTimestamp - archiveSettleSeconds;

  return retentionCutoff < archivedCutoff ? retentionCutoff : archivedCutoff;
};
