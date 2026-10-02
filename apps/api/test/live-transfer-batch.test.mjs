import assert from "node:assert/strict";
import { test } from "node:test";
import {
  combineLiveTransferRecords,
  filterLiveTransferBatch,
} from "../dist/transfers/live-transfer-batch.js";

const record = (blockNumber, logIndex) => ({
  blockNumber: BigInt(blockNumber),
  id: `${blockNumber}-${logIndex}`,
  logIndex,
});

test("newest and large transfers merge oldest first without duplicates", () => {
  const newest = [record(12, 4), record(12, 1), record(11, 9)];
  const large = [record(12, 1), record(10, 3)];

  assert.deepEqual(
    combineLiveTransferRecords(newest, large).map((transfer) => transfer.id),
    ["10-3", "11-9", "12-1", "12-4"],
  );
});

test("filtered batches keep the poll cursor and only matching amounts", () => {
  const transfer = (id, usdc) => ({ amount: { raw: (BigInt(usdc) * 1_000_000n).toString() }, id });
  const batch = {
    cursor: { blockNumber: "12", logIndex: 4 },
    generatedAt: "2026-10-02T00:00:00.000Z",
    transfers: [transfer("small", 9_999), transfer("large", 10_000), transfer("whale", 1_000_000)],
  };

  assert.equal(filterLiveTransferBatch(batch, "all"), batch);
  assert.deepEqual(
    filterLiveTransferBatch(batch, "large").transfers.map((item) => item.id),
    ["large", "whale"],
  );
  const whales = filterLiveTransferBatch(batch, "whale");
  assert.deepEqual(
    whales.transfers.map((item) => item.id),
    ["whale"],
  );
  assert.deepEqual(whales.cursor, batch.cursor);
});
