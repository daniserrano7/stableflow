import type {
  BridgeFlowRow,
  EntityFlowRow,
  EntityPairFlowRow,
  InspectionWindow,
  LabelSummaryRow,
  TransferMetrics,
  VolumeBucketMetrics,
} from "./queries.js";
import {
  formatInteger,
  formatPercent,
  formatUsdc,
  getOverallStatus,
  renderChecks,
} from "./reporting.js";
import type { EmptyReport, FlowReport, ReconcileReport, SummaryReport } from "./reports.js";

const renderWindow = (window: InspectionWindow) => {
  console.log(`Window: last ${window.minutes.toString()} minute bucket(s)`);
  console.log(
    `Range: ${new Date(Number(window.startEpoch) * 1000).toISOString()} -> ${new Date(
      Number(window.endEpochExclusive) * 1000,
    ).toISOString()}`,
  );
  console.log(
    `Latest indexed block: ${window.latestBlock.toString()} (${new Date(
      Number(window.latestTimestamp) * 1000,
    ).toISOString()})`,
  );
  console.log(`Total indexed transfers: ${formatInteger(window.totalIndexedTransfers)}`);
};

const renderTransferMetrics = ({
  rawTransfers,
  volumeBuckets,
}: {
  rawTransfers: TransferMetrics;
  volumeBuckets?: VolumeBucketMetrics;
}) => {
  console.log("");
  console.log("Raw Transfers");
  console.log(`- count: ${formatInteger(rawTransfers.transferCount)}`);
  console.log(`- volume: ${formatUsdc(rawTransfers.totalValue)}`);

  if (rawTransfers.minBlock !== null && rawTransfers.maxBlock !== null) {
    console.log(
      `- blocks: ${rawTransfers.minBlock.toString()} -> ${rawTransfers.maxBlock.toString()}`,
    );
  }

  if (volumeBuckets !== undefined) {
    console.log("");
    console.log("Volume Buckets");
    console.log(`- rows: ${formatInteger(volumeBuckets.rowCount)}`);
    console.log(`- count: ${formatInteger(volumeBuckets.transferCount)}`);
    console.log(`- volume: ${formatUsdc(volumeBuckets.totalValue)}`);
  }
};

const renderEntityFlows = (flows: EntityFlowRow[]) => {
  console.log("");
  console.log("Top Entity Flows");

  if (flows.length === 0) {
    console.log("- none");
    return;
  }

  for (const flow of flows) {
    console.log(
      `- ${flow.entityName} (${flow.category}, ${flow.direction}): ${formatUsdc(
        flow.totalValue,
      )} across ${formatInteger(flow.transferCount)} transfers`,
    );
  }
};

const renderEntityPairFlows = (flows: EntityPairFlowRow[]) => {
  console.log("");
  console.log("Top Entity Pair Flows");

  if (flows.length === 0) {
    console.log("- none");
    return;
  }

  for (const flow of flows) {
    console.log(
      `- ${flow.fromEntityName} -> ${flow.toEntityName}: ${formatUsdc(
        flow.totalValue,
      )} across ${formatInteger(flow.transferCount)} transfers`,
    );
  }
};

const renderBridgeFlows = (flows: BridgeFlowRow[]) => {
  console.log("");
  console.log("Bridge Semantic Flows");

  if (flows.length === 0) {
    console.log("- none");
    return;
  }

  for (const flow of flows) {
    const remote = flow.remoteChainId ?? flow.remoteDomain;
    const remoteLabel = remote === null ? "unknown remote" : `remote=${remote.toString()}`;

    console.log(
      `- ${flow.bridgeName} ${flow.direction} (${remoteLabel}): ${formatUsdc(
        flow.totalValue,
      )} across ${formatInteger(flow.eventCount)} events`,
    );
  }
};

const renderLabels = (labels: LabelSummaryRow[]) => {
  console.log("");
  console.log("Discovered Labels");

  if (labels.length === 0) {
    console.log("- none");
    return;
  }

  for (const label of labels) {
    console.log(
      `- ${label.entityName} (${label.category}, ${label.sourceType}): ${formatInteger(
        label.labelCount,
      )}`,
    );
  }
};

export const renderEmptyReport = (report: EmptyReport) => {
  console.log(`${report.kind}: ${report.message}`);
};

export const renderSummaryReport = (report: SummaryReport) => {
  console.log("Stableflow Indexer Summary");
  renderWindow(report.window);
  renderTransferMetrics({
    rawTransfers: report.rawTransfers,
    volumeBuckets: report.volumeBuckets,
  });
  console.log("");
  console.log("Attribution");
  console.log(
    `- unidentified directional share: ${formatPercent(
      report.entityFlowMetrics.unidentifiedValue,
      report.entityFlowMetrics.totalValue,
    )}`,
  );
  console.log(
    `- entity directional transfers: ${formatInteger(report.entityFlowMetrics.transferCount)}`,
  );
  console.log(
    `- entity pair transfers: ${formatInteger(report.entityPairFlowMetrics.transferCount)}`,
  );
  renderEntityFlows(report.entityFlows);
  renderEntityPairFlows(report.entityPairFlows);
  renderBridgeFlows(report.bridgeFlows);
  renderLabels(report.labels);
};

export const renderFlowReport = (report: FlowReport) => {
  console.log("Stableflow Flow Inspection");
  renderWindow(report.window);
  renderTransferMetrics({ rawTransfers: report.rawTransfers });
  renderEntityFlows(report.entityFlows);
  renderEntityPairFlows(report.entityPairFlows);
  renderBridgeFlows(report.bridgeFlows);
};

export const renderReconcileReport = (report: ReconcileReport) => {
  console.log("Stableflow Reconciliation");
  renderWindow(report.window);
  renderTransferMetrics({
    rawTransfers: report.rawTransfers,
    volumeBuckets: report.volumeBuckets,
  });
  console.log("");
  console.log(`Overall status: ${getOverallStatus(report.checks)}`);
  renderChecks(report.checks);
};
