import { renderEmptyReport, renderReconcileReport } from "./render.js";
import { getOverallStatus } from "./reporting.js";
import { buildReconcileReport } from "./reports.js";
import { runInspectionCommand } from "./run.js";

runInspectionCommand({
  buildReport: buildReconcileReport,
  getExitCode: (report) => {
    if ("message" in report) {
      return 0;
    }

    return getOverallStatus(report.checks) === "FAIL" ? 1 : 0;
  },
  renderReport: (report) => {
    if ("message" in report) {
      renderEmptyReport(report);
      return;
    }

    renderReconcileReport(report);
  },
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
