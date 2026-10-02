import assert from "node:assert/strict";
import test from "node:test";
import { decodeCheckpoint, getBucketCopyStart, getRetentionCutoffBlock } from "../archive/cycle.js";
import { archivedLabelsTable, archivedTables } from "../archive/tables.js";

test("finalized checkpoints decode to block timestamp and number", () => {
  const checkpoint = "179069995300000000000084530000000051955303999999999999999999999999999999999";

  assert.deepEqual(decodeCheckpoint(checkpoint), {
    blockNumber: 51955303n,
    blockTimestamp: 1790699953n,
  });
});

test("bucket copies start at unsettled minutes but never before a deployment's first complete minute", () => {
  // Empty archive: copy everything the live deployment has.
  assert.equal(
    getBucketCopyStart({ archivedMax: null, finalizedTimestamp: 1000n, liveFirstBucket: 600n }),
    -1n,
  );
  // Caught up: re-copy from the minute before the finalized one.
  assert.equal(
    getBucketCopyStart({ archivedMax: 2000n, finalizedTimestamp: 1000n, liveFirstBucket: 600n }),
    900n,
  );
  // Behind a fresh deployment: skip the minute it only partly saw.
  assert.equal(
    getBucketCopyStart({ archivedMax: 500n, finalizedTimestamp: 1000n, liveFirstBucket: 600n }),
    660n,
  );
  assert.equal(
    getBucketCopyStart({ archivedMax: 500n, finalizedTimestamp: 1000n, liveFirstBucket: null }),
    500n,
  );
});

test("retention cutoffs count Base blocks every 2 seconds", () => {
  assert.equal(getRetentionCutoffBlock(1_000_000n, 14 * 24), 395_200n);
  assert.equal(getRetentionCutoffBlock(1_000_000n, 0.5), 999_100n);
});

test("archive tables mirror the indexer schema, plus an archived_at cursor for labels", () => {
  const transfers = archivedTables.find((table) => table.name === "usdc_transfers");

  assert.equal(transfers?.kind, "event");
  assert.deepEqual(transfers?.primaryKey, ["id"]);
  assert.deepEqual(transfers?.columns, [
    "id",
    "chain_id",
    "block_number",
    "block_timestamp",
    "transaction_hash",
    "log_index",
    "from_address",
    "to_address",
    "value",
  ]);
  assert.match(
    transfers?.ddl[0] ?? "",
    /^create table if not exists stableflow_archive\.usdc_transfers \(id text not null, .*value numeric\(78\) not null, primary key \(id\)\)$/,
  );
  assert.ok(
    transfers?.ddl.includes(
      "create index if not exists usdc_transfers_block_number_idx on stableflow_archive.usdc_transfers (block_number)",
    ),
  );
  assert.deepEqual(
    archivedTables.filter((table) => table.kind === "bucket").map((table) => table.name),
    [
      "usdc_transfer_volume_buckets",
      "usdc_entity_flow_buckets",
      "usdc_entity_pair_flow_buckets",
      "usdc_bridge_flow_buckets",
    ],
  );
  assert.match(archivedLabelsTable.ddl[0] ?? "", /archived_at bigint not null default/);
  assert.ok(!archivedLabelsTable.columns.includes("archived_at"));
});
