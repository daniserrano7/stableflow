import { renderEmptyReport, renderFlowReport } from "./render.js";
import { buildFlowReport } from "./reports.js";
import { runInspectionCommand } from "./run.js";

runInspectionCommand({
  buildReport: buildFlowReport,
  renderReport: (report) => {
    if ("message" in report) {
      renderEmptyReport(report);
      return;
    }

    renderFlowReport(report);
  },
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
