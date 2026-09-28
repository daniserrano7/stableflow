import { parseInspectionArgs } from "./args.js";
import { createOperatorDb } from "./db.js";
import { runDiscovery } from "./discovery.js";
import { printJson } from "./reporting.js";

const run = async () => {
  const args = parseInspectionArgs([
    "--minutes",
    "1440",
    "--limit",
    "50",
    ...process.argv.slice(2),
  ]);
  const db = createOperatorDb();

  try {
    const report = await runDiscovery(db, args);

    if (args.json) {
      printJson(report);
      return;
    }

    console.log("Stableflow Label Discovery");
    console.log(`Status: ${report.status}`);
    console.log(`Scanned: ${report.scannedCount.toString()}`);
    console.log(`On-chain verified: ${report.verifiedCount.toString()}`);
    console.log(`Promoted: ${report.promotedCount.toString()}`);
    console.log(`Restored after index reset: ${report.restoredCount.toString()}`);
    console.log(
      `Unidentified directional share: ${(report.unidentifiedDirectionalShareBps / 100).toFixed(2)}%`,
    );
    console.log(
      `Promoted candidate touch share: ${(report.promotedTouchShareBps / 100).toFixed(2)}%`,
    );
    console.log(`Duration: ${report.durationMs.toString()} ms`);
  } finally {
    await db.close();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
