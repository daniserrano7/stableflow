import { renderEmptyReport, renderSummaryReport } from "./render.js";
import { buildSummaryReport } from "./reports.js";
import { runInspectionCommand } from "./run.js";

runInspectionCommand({
  buildReport: buildSummaryReport,
  renderReport: (report) => {
    if ("message" in report) {
      renderEmptyReport(report);
      return;
    }

    renderSummaryReport(report);
  },
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
