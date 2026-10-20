import assert from "node:assert/strict";
import test from "node:test";
import { archiveSettleSeconds, getLiveRetentionCutoff } from "../src/retention/cutoff.js";

const sixHours = 6n * 3600n;

test("live rows are pruned only past the retention window and once archived", () => {
  // Archiver caught up: the retention window decides.
  assert.equal(
    getLiveRetentionCutoff({
      archivedThroughTimestamp: 100_000n,
      blockTimestamp: 100_000n,
      retentionSeconds: sixHours,
    }),
    100_000n - sixHours,
  );
  // Archiver behind: never prune what it hasn't copied, minus a settle margin.
  assert.equal(
    getLiveRetentionCutoff({
      archivedThroughTimestamp: 50_000n,
      blockTimestamp: 100_000n,
      retentionSeconds: 600n,
    }),
    50_000n - archiveSettleSeconds,
  );
  // Empty archive, e.g. during the first backfill: keep everything.
  assert.equal(
    getLiveRetentionCutoff({
      archivedThroughTimestamp: null,
      blockTimestamp: 100_000n,
      retentionSeconds: sixHours,
    }),
    null,
  );
});
