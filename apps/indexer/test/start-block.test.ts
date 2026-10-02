import assert from "node:assert/strict";
import test from "node:test";
import { archiveOverlapBlocks, chooseStartBlock } from "../scripts/start-block.js";

test("new deployments start before the archive's newest transfer", () => {
  assert.deepEqual(chooseStartBlock({ archivedMaxBlock: 1_000n, initialStartBlock: 5n }), {
    source: "archive",
    startBlock: 1_000n - archiveOverlapBlocks,
  });
  // The overlap must cover at least one full minute of 2-second blocks.
  assert.ok(archiveOverlapBlocks >= 30n);
});

test("the first deployment uses the configured block, which is then required", () => {
  assert.deepEqual(chooseStartBlock({ archivedMaxBlock: null, initialStartBlock: 5n }), {
    source: "initial",
    startBlock: 5n,
  });
  assert.throws(
    () => chooseStartBlock({ archivedMaxBlock: null, initialStartBlock: undefined }),
    /PONDER_DISCOVERY_START_BLOCK_8453 is required/,
  );
});
