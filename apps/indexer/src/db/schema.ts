import { bigint, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";

export const usdcTransfers = pgTable(
  "usdc_transfers",
  {
    id: text("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: bigint("block_timestamp", { mode: "bigint" }).notNull(),
    transactionHash: text("transaction_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    value: bigint("value", { mode: "bigint" }).notNull(),
  },
  (table) => ({
    transactionHashLogIndexUnique: unique("usdc_transfers_tx_hash_log_index_unique").on(
      table.transactionHash,
      table.logIndex,
    ),
    blockNumberIndex: index("usdc_transfers_block_number_idx").on(table.blockNumber),
  }),
);
