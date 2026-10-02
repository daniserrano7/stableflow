import assert from "node:assert/strict";
import test from "node:test";
import type { CandidateVerification } from "./candidates.js";
import { isAutoPromotable } from "./discovery-policy.js";

const verifiedPool: CandidateVerification = {
  attributionGroup: "aerodrome",
  confidence: "high",
  countingPolicy: "boundary",
  evidenceDetails: "{}",
  evidenceSource: "onchain_factory_membership",
  poolKind: "slipstream_pool",
  sourceAddress: "0x1111",
  sourceEvent: "factory.isPool(pool)",
  suggestedCategory: "dex",
  suggestedEntityId: "aerodrome",
  suggestedEntityName: "Aerodrome",
  suggestedRole: "pool_instance",
  token0: "0x2222",
  token1: "0x3333",
  verifier: "aerodrome_slipstream_pool_identity",
};

test("auto-promotion requires deterministic boundary evidence", () => {
  assert.equal(isAutoPromotable(verifiedPool), true);
  assert.equal(
    isAutoPromotable({ ...verifiedPool, evidenceSource: "onchain_pool_identity" }),
    false,
  );
  assert.equal(
    isAutoPromotable({ ...verifiedPool, evidenceSource: "known_counterparty_pattern" }),
    false,
  );
  assert.equal(isAutoPromotable({ ...verifiedPool, confidence: "candidate" }), false);
  assert.equal(isAutoPromotable({ ...verifiedPool, countingPolicy: "internal" }), false);
  assert.equal(isAutoPromotable({ ...verifiedPool, suggestedEntityId: "unidentified" }), false);
});
