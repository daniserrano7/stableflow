import { parseInspectionArgs } from "./args.js";
import { createReadOnlyDb } from "./db.js";
import { printJson } from "./reporting.js";

export const runInspectionCommand = async <Report>({
  buildReport,
  getExitCode,
  renderReport,
}: {
  buildReport: (
    db: ReturnType<typeof createReadOnlyDb>,
    args: ReturnType<typeof parseInspectionArgs>,
  ) => Promise<Report>;
  getExitCode?: (report: Report) => number;
  renderReport: (report: Report) => void;
}) => {
  const args = parseInspectionArgs();
  const db = createReadOnlyDb();

  try {
    const report = await buildReport(db, args);

    if (args.json) {
      printJson(report);
    } else {
      renderReport(report);
    }

    process.exitCode = getExitCode?.(report) ?? 0;
  } finally {
    await db.close();
  }
};
