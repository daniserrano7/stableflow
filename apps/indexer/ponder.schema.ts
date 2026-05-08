import { index, onchainTable } from "ponder";

export const usdcTransfers = onchainTable(
  "usdc_transfers",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    fromAddress: t.hex().notNull(),
    toAddress: t.hex().notNull(),
    value: t.bigint().notNull(),
  }),
  (table) => ({
    blockNumberIndex: index("usdc_transfers_block_number_idx").on(table.blockNumber),
  }),
);

export const usdcTransferVolumeBuckets = onchainTable(
  "usdc_transfer_volume_buckets",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    tokenAddress: t.hex().notNull(),
    bucketSize: t.text().notNull(),
    bucketStart: t.bigint().notNull(),
    transferCount: t.bigint().notNull(),
    totalValue: t.bigint().notNull(),
  }),
  (table) => ({
    bucketStartIndex: index("usdc_transfer_volume_buckets_bucket_start_idx").on(table.bucketStart),
  }),
);

export const usdcEntityFlowBuckets = onchainTable(
  "usdc_entity_flow_buckets",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    tokenAddress: t.hex().notNull(),
    bucketSize: t.text().notNull(),
    bucketStart: t.bigint().notNull(),
    entityId: t.text().notNull(),
    entityName: t.text().notNull(),
    category: t.text().notNull(),
    direction: t.text().notNull(),
    transferCount: t.bigint().notNull(),
    totalValue: t.bigint().notNull(),
  }),
  (table) => ({
    bucketStartIndex: index("usdc_entity_flow_buckets_bucket_start_idx").on(table.bucketStart),
    entityIdIndex: index("usdc_entity_flow_buckets_entity_id_idx").on(table.entityId),
  }),
);

export const usdcEntityPairFlowBuckets = onchainTable(
  "usdc_entity_pair_flow_buckets",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    tokenAddress: t.hex().notNull(),
    bucketSize: t.text().notNull(),
    bucketStart: t.bigint().notNull(),
    fromEntityId: t.text().notNull(),
    fromEntityName: t.text().notNull(),
    fromCategory: t.text().notNull(),
    toEntityId: t.text().notNull(),
    toEntityName: t.text().notNull(),
    toCategory: t.text().notNull(),
    transferCount: t.bigint().notNull(),
    totalValue: t.bigint().notNull(),
  }),
  (table) => ({
    bucketStartIndex: index("usdc_entity_pair_flow_buckets_bucket_start_idx").on(table.bucketStart),
    fromEntityIdIndex: index("usdc_entity_pair_flow_buckets_from_entity_id_idx").on(
      table.fromEntityId,
    ),
    toEntityIdIndex: index("usdc_entity_pair_flow_buckets_to_entity_id_idx").on(table.toEntityId),
  }),
);

export const usdcBridgeFlowBuckets = onchainTable(
  "usdc_bridge_flow_buckets",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    tokenAddress: t.hex().notNull(),
    bucketSize: t.text().notNull(),
    bucketStart: t.bigint().notNull(),
    bridgeId: t.text().notNull(),
    bridgeName: t.text().notNull(),
    direction: t.text().notNull(),
    remoteChainId: t.bigint(),
    remoteDomain: t.integer(),
    eventCount: t.bigint().notNull(),
    totalValue: t.bigint().notNull(),
  }),
  (table) => ({
    bridgeIdIndex: index("usdc_bridge_flow_buckets_bridge_id_idx").on(table.bridgeId),
    bucketStartIndex: index("usdc_bridge_flow_buckets_bucket_start_idx").on(table.bucketStart),
  }),
);

export const discoveredAddressLabels = onchainTable(
  "discovered_address_labels",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    address: t.hex().notNull(),
    entityId: t.text().notNull(),
    entityName: t.text().notNull(),
    category: t.text().notNull(),
    role: t.text().notNull(),
    attributionGroup: t.text().notNull(),
    countingPolicy: t.text().notNull(),
    confidence: t.text().notNull(),
    sourceType: t.text().notNull(),
    sourceAddress: t.hex().notNull(),
    sourceEvent: t.text().notNull(),
    token0: t.hex(),
    token1: t.hex(),
    poolKind: t.text(),
    firstSeenBlock: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
  }),
  (table) => ({
    addressIndex: index("discovered_address_labels_address_idx").on(table.address),
    entityIdIndex: index("discovered_address_labels_entity_id_idx").on(table.entityId),
  }),
);

export const addressLabelCandidates = onchainTable(
  "address_label_candidates",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    address: t.hex().notNull(),
    status: t.text().notNull(),
    suggestedEntityId: t.text().notNull(),
    suggestedEntityName: t.text().notNull(),
    suggestedCategory: t.text().notNull(),
    suggestedRole: t.text().notNull(),
    attributionGroup: t.text().notNull(),
    countingPolicy: t.text().notNull(),
    confidence: t.text().notNull(),
    evidenceSource: t.text().notNull(),
    evidenceDetails: t.text().notNull(),
    verifier: t.text().notNull(),
    sourceAddress: t.hex().notNull(),
    sourceEvent: t.text().notNull(),
    token0: t.hex(),
    token1: t.hex(),
    poolKind: t.text(),
    observedTransferCount: t.bigint().notNull(),
    observedIncomingCount: t.bigint().notNull(),
    observedOutgoingCount: t.bigint().notNull(),
    observedIncomingValue: t.bigint().notNull(),
    observedOutgoingValue: t.bigint().notNull(),
    observedTotalValue: t.bigint().notNull(),
    firstSeenBlock: t.bigint().notNull(),
    lastSeenBlock: t.bigint().notNull(),
    firstSeenTimestamp: t.bigint().notNull(),
    lastSeenTimestamp: t.bigint().notNull(),
    reviewedAt: t.bigint(),
    promotedAt: t.bigint(),
    rejectionReason: t.text(),
  }),
  (table) => ({
    addressIndex: index("address_label_candidates_address_idx").on(table.address),
    observedTotalValueIndex: index("address_label_candidates_observed_total_value_idx").on(
      table.observedTotalValue,
    ),
    statusIndex: index("address_label_candidates_status_idx").on(table.status),
  }),
);
