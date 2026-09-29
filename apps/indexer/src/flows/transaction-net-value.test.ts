import assert from "node:assert/strict";
import test from "node:test";
import { TransactionNetValueTracker } from "./transaction-net-value.js";

const sumTransaction = (
  tracker: TransactionNetValueTracker,
  transactionHash: string,
  transfers: [from: string, to: string, value: bigint][],
) =>
  transfers.reduce(
    (total, [from, to, value]) => total + tracker.add({ from, to, transactionHash, value }),
    0n,
  );

test("pass-through hops inside one transaction count once", () => {
  const tracker = new TransactionNetValueTracker();
  assert.equal(
    sumTransaction(tracker, "0x1", [
      ["0xA", "0xRouter", 100n],
      ["0xRouter", "0xPool", 100n],
      ["0xPool", "0xB", 100n],
    ]),
    100n,
  );
});

test("independent legs into one receiver all count", () => {
  const tracker = new TransactionNetValueTracker();
  assert.equal(
    sumTransaction(tracker, "0x1", [
      ["0xPool1", "0xRouter", 60n],
      ["0xPool2", "0xRouter", 40n],
    ]),
    100n,
  );
});

test("round trips and self transfers move nothing", () => {
  const tracker = new TransactionNetValueTracker();
  assert.equal(
    sumTransaction(tracker, "0x1", [
      ["0xA", "0xB", 50n],
      ["0xb", "0xa", 50n],
      ["0xC", "0xC", 10n],
    ]),
    0n,
  );
});

test("a new transaction starts from zero", () => {
  const tracker = new TransactionNetValueTracker();
  sumTransaction(tracker, "0x1", [["0xA", "0xB", 70n]]);
  assert.equal(sumTransaction(tracker, "0x2", [["0xB", "0xC", 70n]]), 70n);
});
