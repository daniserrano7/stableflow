import { parseInspectionArgs } from "./args.js";
import { getUnidentifiedAddressCandidates } from "./candidates.js";
import { createReadOnlyDb } from "./db.js";
import { getRawTransferMetrics } from "./queries.js";
import { formatInteger, formatPercent, formatUsdc, printJson } from "./reporting.js";

const run = async () => {
  const args = parseInspectionArgs();
  const db = createReadOnlyDb();

  try {
    const { candidates, window } = await getUnidentifiedAddressCandidates(db, args);

    if (window === null) {
      const report = {
        generatedAt: new Date().toISOString(),
        kind: "unidentified",
        message: "No indexed USDC transfers found.",
      };

      if (args.json) {
        printJson(report);
      } else {
        console.log(report.message);
      }

      return;
    }

    const rawTransfers = await getRawTransferMetrics(db, window);
    const candidateTouchValue = candidates.reduce(
      (total, candidate) => total + candidate.totalTouchValue,
      0n,
    );
    const report = {
      candidates,
      candidateTouchShare: formatPercent(candidateTouchValue, rawTransfers.totalValue * 2n),
      generatedAt: new Date().toISOString(),
      kind: "unidentified",
      rawTransfers,
      window,
    };

    if (args.json) {
      printJson(report);
      return;
    }

    console.log("Stableflow Unidentified Address Inspection");
    console.log(`Window: last ${window.minutes.toString()} minute bucket(s)`);
    console.log(
      `Range: ${new Date(Number(window.startEpoch) * 1000).toISOString()} -> ${new Date(
        Number(window.endEpochExclusive) * 1000,
      ).toISOString()}`,
    );
    console.log(`Raw transfer volume: ${formatUsdc(rawTransfers.totalValue)}`);
    console.log(
      `Top ${candidates.length.toString()} candidate touch share: ${report.candidateTouchShare}`,
    );
    console.log("");
    console.log("Top Unidentified Addresses");

    if (candidates.length === 0) {
      console.log("- none");
      return;
    }

    for (const candidate of candidates) {
      const status = candidate.candidateStatus ?? "new";

      console.log(
        `- ${candidate.address} | status=${status} | touch=${formatUsdc(
          candidate.totalTouchValue,
        )} | transfers=${formatInteger(candidate.transferCount)} | counterparties=${formatInteger(
          candidate.uniqueCounterparties,
        )}`,
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
