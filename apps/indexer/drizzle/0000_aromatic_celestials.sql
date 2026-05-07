CREATE TABLE "usdc_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" bigint NOT NULL,
	"transaction_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"value" bigint NOT NULL,
	CONSTRAINT "usdc_transfers_tx_hash_log_index_unique" UNIQUE("transaction_hash","log_index")
);
--> statement-breakpoint
CREATE INDEX "usdc_transfers_block_number_idx" ON "usdc_transfers" USING btree ("block_number");