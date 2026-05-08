import { parseInspectionArgs } from "./args.js";
import { promoteVerifiedCandidates } from "./candidates.js";
import { createOperatorDb } from "./db.js";
import { formatUsdc, printJson } from "./reporting.js";

const run = async () => {
  const args = parseInspectionArgs();
  const db = createOperatorDb();

  try {
    const promoted = await promoteVerifiedCandidates(db, args.limit);
    const report = {
      generatedAt: new Date().toISOString(),
      kind: "candidate_promotion",
      promoted,
    };

    if (args.json) {
      printJson(report);
      return;
    }

    console.log("Stableflow Candidate Promotion");
    console.log(`Promoted candidates: ${promoted.length.toString()}`);

    for (const candidate of promoted) {
      console.log(
        `- ${candidate.address} | entity=${candidate.suggestedEntityName} | role=${
          candidate.suggestedRole
        } | observed=${formatUsdc(candidate.totalTouchValue)}`,
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
