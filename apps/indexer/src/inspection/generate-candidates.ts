import { parseInspectionArgs } from "./args.js";
import { verifyCandidate } from "./candidate-verifiers.js";
import {
  getFallbackCandidateVerification,
  getUnidentifiedAddressCandidates,
  upsertAddressLabelCandidate,
} from "./candidates.js";
import { createOperatorDb } from "./db.js";
import { formatUsdc, printJson } from "./reporting.js";

const run = async () => {
  const args = parseInspectionArgs();
  const db = createOperatorDb();

  try {
    const { candidates, window } = await getUnidentifiedAddressCandidates(db, args);
    const generated = [];

    for (const candidate of candidates) {
      const verification =
        (await verifyCandidate(candidate)) ?? getFallbackCandidateVerification(candidate);

      await upsertAddressLabelCandidate({
        candidate,
        db,
        verification,
      });

      generated.push({
        address: candidate.address,
        confidence: verification.confidence,
        entity: verification.suggestedEntityName,
        evidenceSource: verification.evidenceSource,
        status: verification.confidence === "high" ? "verified" : "candidate",
        totalTouchValue: candidate.totalTouchValue,
        verifier: verification.verifier,
      });
    }

    const report = {
      generated,
      generatedAt: new Date().toISOString(),
      kind: "candidate_generation",
      window,
    };

    if (args.json) {
      printJson(report);
      return;
    }

    console.log("Stableflow Candidate Generation");

    if (window === null) {
      console.log("No indexed USDC transfers found.");
      return;
    }

    console.log(`Window: last ${window.minutes.toString()} minute bucket(s)`);
    console.log(`Generated or refreshed candidates: ${generated.length.toString()}`);

    for (const candidate of generated) {
      console.log(
        `- ${candidate.address} | status=${candidate.status} | entity=${candidate.entity} | touch=${formatUsdc(
          candidate.totalTouchValue,
        )} | verifier=${candidate.verifier}`,
      );
    }
  } finally {
    await db.close();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
