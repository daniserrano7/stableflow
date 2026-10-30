import { describe, expect, it } from "vitest";
import { TransactionNetValueTracker } from "./flows/transaction-net-value";
import { getEntityFlowUpdates, getEntityPairFlowUpdate } from "./lib/flows";
import { isBaseUsdcToken } from "./lib/constants";
import { parseCctpBurnMessageBody } from "./handlers/base-usdc";

const dex = { attributionGroup: "aerodrome", category: "dex", countingPolicy: "boundary", entityId: "aerodrome", entityName: "Aerodrome" } as const;
const router = { ...dex, countingPolicy: "internal" } as const;
const lending = { attributionGroup: "aave-v3", category: "lending", countingPolicy: "boundary", entityId: "aave-v3", entityName: "Aave V3" } as const;

describe("TransactionNetValueTracker", () => {
  it("counts a routed swap once", () => {
    const t = new TransactionNetValueTracker();
    const a = t.add({ from: "0xa", to: "0xr", transactionHash: "0x1", value: 100n });
    const b = t.add({ from: "0xr", to: "0xb", transactionHash: "0x1", value: 100n });
    expect(a + b).toBe(100n);
  });
  it("resets between transactions and ignores self transfers", () => {
    const t = new TransactionNetValueTracker();
    t.add({ from: "0xa", to: "0xb", transactionHash: "0x1", value: 5n });
    expect(t.add({ from: "0xa", to: "0xb", transactionHash: "0x2", value: 7n })).toBe(7n);
    expect(t.add({ from: "0xA", to: "0xa", transactionHash: "0x2", value: 9n })).toBe(0n);
  });
});

describe("flow updates", () => {
  it("ignores transfers inside one attribution group", () => {
    expect(getEntityFlowUpdates({ fromLabel: dex, toLabel: router })).toEqual([]);
    expect(getEntityPairFlowUpdate({ fromLabel: dex, toLabel: router })).toBeUndefined();
  });
  it("counts boundary crossings and fills the unknown side with Unidentified", () => {
    const updates = getEntityFlowUpdates({ fromLabel: undefined, toLabel: dex });
    expect(updates.map((u) => [u.direction, u.label.entityId])).toEqual([["out", "unidentified"], ["in", "aerodrome"]]);
    expect(getEntityPairFlowUpdate({ fromLabel: lending, toLabel: undefined })?.toLabel.entityId).toBe("unidentified");
  });
  it("counts two unknown wallets as Unidentified in and out", () => {
    expect(getEntityFlowUpdates({ fromLabel: undefined, toLabel: undefined })).toHaveLength(2);
  });
});

describe("bridges", () => {
  it("matches USDC as an address and as bytes32", () => {
    expect(isBaseUsdcToken("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(true);
    expect(isBaseUsdcToken("0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913")).toBe(true);
    expect(isBaseUsdcToken("0x0000000000000000000000000000000000000001")).toBe(false);
  });
  it("reads the CCTP burn amount net of the fee and rejects other versions", () => {
    const word = (n: bigint) => n.toString(16).padStart(64, "0");
    const body = (version: number, amount: bigint, fee: bigint) =>
      `0x${version.toString(16).padStart(8, "0")}${"00".repeat(64)}${word(amount)}${"00".repeat(64)}${word(fee)}`;
    expect(parseCctpBurnMessageBody(body(1, 1000n, 3n))).toEqual({ netAmount: 997n });
    expect(parseCctpBurnMessageBody(body(2, 1000n, 3n))).toBeNull();
    expect(parseCctpBurnMessageBody(body(1, 1n, 3n))).toBeNull();
    expect(parseCctpBurnMessageBody("0x00")).toBeNull();
  });
});
