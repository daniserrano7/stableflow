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
