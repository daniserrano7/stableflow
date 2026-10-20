import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseLiveTransferEventId,
  toLiveTransferEventId,
} from "../dist/transfers/live-transfer-event-id.js";
import { TransfersController } from "../dist/transfers/transfers.controller.js";

test("live transfer event IDs round trip and reject malformed cursors", () => {
  const cursor = { blockNumber: "51908892", logIndex: 2821 };
  assert.equal(toLiveTransferEventId(cursor), "51908892:2821");
  assert.deepEqual(parseLiveTransferEventId("51908892:2821"), cursor);
  assert.equal(toLiveTransferEventId(null), "latest");
  assert.equal(parseLiveTransferEventId("latest"), null);

  for (const value of [
    "",
    "1",
    "-1:0",
    "1:-1",
    "1:1.5",
    "1:2147483648",
    "99999999999999999999:0",
  ]) {
    assert.equal(parseLiveTransferEventId(value), undefined, value);
  }
});

test("reconnect header takes precedence over the original stream URL cursor", () => {
  let receivedCursor;
  const controller = new TransfersController({
    createLiveTransfersStream(cursor) {
      receivedCursor = cursor;
      return cursor;
    },
  });

  controller.streamLiveTransfers("10", "2", "20:3");
  assert.deepEqual(receivedCursor, { blockNumber: "20", logIndex: 3 });

  controller.streamLiveTransfers("10", "2", "latest");
  assert.equal(receivedCursor, null);

  controller.streamLiveTransfers("10", "2", "invalid");
  assert.deepEqual(receivedCursor, { blockNumber: "10", logIndex: 2 });
});

test("the stream filter defaults to all and rejects unknown values", () => {
  let receivedFilter;
  const controller = new TransfersController({
    createLiveTransfersStream(_cursor, filter) {
      receivedFilter = filter;
    },
  });

  controller.streamLiveTransfers(undefined, undefined, undefined, undefined);
  assert.equal(receivedFilter, "all");

  controller.streamLiveTransfers(undefined, undefined, undefined, "whale");
  assert.equal(receivedFilter, "whale");

  assert.throws(
    () => controller.streamLiveTransfers(undefined, undefined, undefined, "huge"),
    (error) => error.getStatus?.() === 400,
  );
});
