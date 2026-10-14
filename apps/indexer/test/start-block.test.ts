import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveOverlapBlocks,
  chooseStartBlock,
  maxBackfillBlocks,
} from "../scripts/start-block.js";

test("new deployments start before the archive's newest transfer", () => {
  assert.deepEqual(
    chooseStartBlock({ archivedMaxBlock: 1_000n, headBlock: 1_100n, initialStartBlock: 5n }),
    { source: "archive", startBlock: 1_000n - archiveOverlapBlocks },
  );
  // The overlap must cover at least one full minute of 2-second blocks.
  assert.ok(archiveOverlapBlocks >= 30n);
});

test("a stale archive is skipped: deployments start near the chain head", () => {
  assert.deepEqual(
    chooseStartBlock({ archivedMaxBlock: 1_000n, headBlock: 100_000n, initialStartBlock: 5n }),
    { source: "head", startBlock: 100_000n - maxBackfillBlocks },
  );
});

test("the first deployment uses the configured block, or the chain head", () => {
  assert.deepEqual(
    chooseStartBlock({ archivedMaxBlock: null, headBlock: 100_000n, initialStartBlock: 5n }),
    { source: "initial", startBlock: 5n },
  );
  assert.deepEqual(
    chooseStartBlock({ archivedMaxBlock: null, headBlock: 100_000n, initialStartBlock: undefined }),
    { source: "head", startBlock: 100_000n - maxBackfillBlocks },
  );
});
