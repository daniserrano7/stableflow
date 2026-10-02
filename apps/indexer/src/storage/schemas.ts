/**
 * Durable schemas outside Ponder. Every indexer deployment indexes into a fresh
 * Ponder schema that only holds recent data, so anything that must outlive a
 * deployment lives in one of these.
 */

/** Operator workflow state: label candidate reviews and discovery runs. */
export const opsSchema = "stableflow_ops";

export const opsTables = {
  addressLabelCandidateReviews: `${opsSchema}.address_label_candidate_reviews`,
  addressLabelDiscoveryRuns: `${opsSchema}.address_label_discovery_runs`,
} as const;

/**
 * Copies of the indexer tables that the API reads: raw events for a retention
 * window, aggregates and address labels forever. The archiver keeps it in sync.
 */
export const archiveSchema = "stableflow_archive";

export const archiveTables = {
  discoveredAddressLabels: `${archiveSchema}.discovered_address_labels`,
  usdcTransfers: `${archiveSchema}.usdc_transfers`,
} as const;

/** Indexer bookkeeping: the start block each deployment schema was created with. */
export const indexerStateSchema = "stableflow_indexer";

export const indexerStateTables = {
  deployments: `${indexerStateSchema}.deployments`,
} as const;
