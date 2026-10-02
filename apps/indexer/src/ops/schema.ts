/**
 * Operator-owned state lives outside Ponder's schema. Each indexer deployment
 * indexes into a fresh Ponder schema, so anything written here must survive it.
 */
export const opsSchema = "stableflow_ops";

export const opsTables = {
  addressLabelCandidateReviews: `${opsSchema}.address_label_candidate_reviews`,
  addressLabelDiscoveryRuns: `${opsSchema}.address_label_discovery_runs`,
  promotedAddressLabels: `${opsSchema}.promoted_address_labels`,
} as const;
