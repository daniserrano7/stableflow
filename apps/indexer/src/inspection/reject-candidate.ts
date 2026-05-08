import { parseInspectionArgs } from "./args.js";
import { rejectAddressLabelCandidate } from "./candidates.js";
import { createOperatorDb } from "./db.js";
import { printJson } from "./reporting.js";

const run = async () => {
  const args = parseInspectionArgs();

  if (args.address === undefined) {
    throw new Error("labels:reject requires --address");
  }

  const db = createOperatorDb();
  const reason = args.reason ?? "manual rejection";

  try {
    const rejected = await rejectAddressLabelCandidate({
      address: args.address,
      db,
      reason,
    });
    const report = {
      address: args.address.toLowerCase(),
      generatedAt: new Date().toISOString(),
      kind: "candidate_rejection",
      reason,
      rejected: rejected !== null,
    };

    if (args.json) {
      printJson(report);
      return;
    }

    if (rejected === null) {
      console.log(`No unpromoted candidate found for ${report.address}`);
      return;
    }

    console.log(`Rejected candidate ${report.address}: ${reason}`);
  } finally {
    await db.close();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
