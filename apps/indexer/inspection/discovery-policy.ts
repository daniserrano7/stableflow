import type { CandidateVerification } from "./candidates.js";

export const isAutoPromotable = (verification: CandidateVerification) =>
  verification.confidence === "high" &&
  verification.evidenceSource === "onchain_factory_membership" &&
  verification.countingPolicy === "boundary" &&
  verification.suggestedEntityId !== "unidentified";
