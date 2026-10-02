import type { InspectionArgs } from "./args.js";
import type { ReadOnlyDb } from "./db.js";
import {
  type BridgeFlowRow,
  type EntityFlowMetrics,
  type EntityFlowRow,
  type EntityPairFlowMetrics,
  type EntityPairFlowRow,
  getBridgeFlows,
  getEntityFlowMetrics,
  getEntityFlows,
  getEntityPairFlowMetrics,
  getEntityPairFlows,
  getInspectionWindow,
  getLabelSummaries,
  getRawTransferMetrics,
  getVolumeBucketMetrics,
  type InspectionWindow,
  type LabelSummaryRow,
  type TransferMetrics,
  type VolumeBucketMetrics,
} from "./queries.js";
import type { InspectionCheck } from "./reporting.js";

export type EmptyReport = {
  generatedAt: string;
  kind: string;
  message: string;
};

export type SummaryReport = {
  bridgeFlows: BridgeFlowRow[];
  entityFlows: EntityFlowRow[];
  entityPairFlows: EntityPairFlowRow[];
  generatedAt: string;
  kind: "summary";
  labels: LabelSummaryRow[];
  entityFlowMetrics: EntityFlowMetrics;
  entityPairFlowMetrics: EntityPairFlowMetrics;
  rawTransfers: TransferMetrics;
  volumeBuckets: VolumeBucketMetrics;
  window: InspectionWindow;
};

export type FlowReport = {
  bridgeFlows: BridgeFlowRow[];
  entityFlows: EntityFlowRow[];
  entityPairFlows: EntityPairFlowRow[];
  generatedAt: string;
  kind: "flows";
  rawTransfers: TransferMetrics;
  window: InspectionWindow;
};

export type ReconcileReport = {
  bridgeFlows: BridgeFlowRow[];
  checks: InspectionCheck[];
  entityFlowMetrics: EntityFlowMetrics;
  entityPairFlowMetrics: EntityPairFlowMetrics;
  generatedAt: string;
  kind: "reconcile";
  rawTransfers: TransferMetrics;
  volumeBuckets: VolumeBucketMetrics;
  window: InspectionWindow;
};

export const buildEmptyReport = (kind: string): EmptyReport => ({
  generatedAt: new Date().toISOString(),
  kind,
  message: "No indexed USDC transfers found.",
});

const getRequiredWindow = async (db: ReadOnlyDb, args: InspectionArgs, kind: string) => {
  const window = await getInspectionWindow(db, args);

  if (window === null) {
    return buildEmptyReport(kind);
  }

  return window;
};

export const buildSummaryReport = async (
  db: ReadOnlyDb,
  args: InspectionArgs,
): Promise<EmptyReport | SummaryReport> => {
  const window = await getRequiredWindow(db, args, "summary");

  if ("message" in window) {
    return window;
  }

  const [
    rawTransfers,
    volumeBuckets,
    entityFlowMetrics,
    entityPairFlowMetrics,
    entityFlows,
    entityPairFlows,
    bridgeFlows,
    labels,
  ] = await Promise.all([
    getRawTransferMetrics(db, window),
    getVolumeBucketMetrics(db, window),
    getEntityFlowMetrics(db, window),
    getEntityPairFlowMetrics(db, window),
    getEntityFlows(db, window, args.limit),
    getEntityPairFlows(db, window, args.limit),
    getBridgeFlows(db, window, args.limit),
    getLabelSummaries(db, args.limit),
  ]);

  return {
    bridgeFlows,
    entityFlows,
    entityFlowMetrics,
    entityPairFlows,
    entityPairFlowMetrics,
    generatedAt: new Date().toISOString(),
    kind: "summary",
    labels,
    rawTransfers,
    volumeBuckets,
    window,
  };
};

export const buildFlowReport = async (
  db: ReadOnlyDb,
  args: InspectionArgs,
): Promise<EmptyReport | FlowReport> => {
  const window = await getRequiredWindow(db, args, "flows");

  if ("message" in window) {
    return window;
  }

  const [rawTransfers, entityFlows, entityPairFlows, bridgeFlows] = await Promise.all([
    getRawTransferMetrics(db, window),
    getEntityFlows(db, window, args.limit),
    getEntityPairFlows(db, window, args.limit),
    getBridgeFlows(db, window, args.limit),
  ]);

  return {
    bridgeFlows,
    entityFlows,
    entityPairFlows,
    generatedAt: new Date().toISOString(),
    kind: "flows",
    rawTransfers,
    window,
  };
};

const buildReconciliationChecks = ({
  bridgeFlows,
  entityFlowMetrics,
  entityPairFlowMetrics,
  rawTransfers,
  volumeBuckets,
}: {
  bridgeFlows: BridgeFlowRow[];
  entityFlowMetrics: EntityFlowMetrics;
  entityPairFlowMetrics: EntityPairFlowMetrics;
  rawTransfers: TransferMetrics;
  volumeBuckets: VolumeBucketMetrics;
}): InspectionCheck[] => {
  const checks: InspectionCheck[] = [];

  checks.push({
    details:
      rawTransfers.transferCount === volumeBuckets.transferCount
        ? `${rawTransfers.transferCount.toString()} transfers`
        : `raw=${rawTransfers.transferCount.toString()}, buckets=${volumeBuckets.transferCount.toString()}`,
    name: "raw transfer count matches volume buckets",
    status: rawTransfers.transferCount === volumeBuckets.transferCount ? "PASS" : "FAIL",
  });

  checks.push({
    details:
      rawTransfers.totalValue === volumeBuckets.totalValue
        ? rawTransfers.totalValue.toString()
        : `raw=${rawTransfers.totalValue.toString()}, buckets=${volumeBuckets.totalValue.toString()}`,
    name: "raw transfer volume matches volume buckets",
    status: rawTransfers.totalValue === volumeBuckets.totalValue ? "PASS" : "FAIL",
  });

  checks.push({
    details:
      rawTransfers.transferCount === 0n || volumeBuckets.rowCount > 0n
        ? `${volumeBuckets.rowCount.toString()} volume bucket rows`
        : "raw transfers exist but no volume buckets were found",
    name: "volume buckets exist when raw transfers exist",
    status: rawTransfers.transferCount === 0n || volumeBuckets.rowCount > 0n ? "PASS" : "FAIL",
  });

  checks.push({
    details:
      entityFlowMetrics.transferCount <= rawTransfers.transferCount * 2n
        ? `entity directional transfers=${entityFlowMetrics.transferCount.toString()}, raw transfers=${rawTransfers.transferCount.toString()}`
        : `entity directional transfers=${entityFlowMetrics.transferCount.toString()}, raw transfers=${rawTransfers.transferCount.toString()}`,
    name: "entity flow expansion does not exceed two directions per raw transfer",
    status: entityFlowMetrics.transferCount <= rawTransfers.transferCount * 2n ? "PASS" : "FAIL",
  });

  checks.push({
    details:
      entityPairFlowMetrics.transferCount <= rawTransfers.transferCount
        ? `pair transfers=${entityPairFlowMetrics.transferCount.toString()}, raw transfers=${rawTransfers.transferCount.toString()}`
        : `pair transfers=${entityPairFlowMetrics.transferCount.toString()}, raw transfers=${rawTransfers.transferCount.toString()}`,
    name: "entity pair flow count does not exceed raw transfers",
    status: entityPairFlowMetrics.transferCount <= rawTransfers.transferCount ? "PASS" : "FAIL",
  });

  checks.push({
    details:
      entityPairFlowMetrics.totalValue <= rawTransfers.totalValue
        ? `pair value=${entityPairFlowMetrics.totalValue.toString()}, raw value=${rawTransfers.totalValue.toString()}`
        : `pair value=${entityPairFlowMetrics.totalValue.toString()}, raw value=${rawTransfers.totalValue.toString()}`,
    name: "entity pair flow value does not exceed raw transfer value",
    status: entityPairFlowMetrics.totalValue <= rawTransfers.totalValue ? "PASS" : "FAIL",
  });

  checks.push({
    details:
      rawTransfers.totalValue === 0n
        ? "no raw transfer value in this window"
        : `unidentified directional value=${entityFlowMetrics.unidentifiedValue.toString()}`,
    name: "unidentified flow share is visible",
    status: rawTransfers.totalValue === 0n ? "WARN" : "PASS",
  });

  const invalidBridgeDirections = bridgeFlows.filter(
    (flow) => flow.direction !== "inbound" && flow.direction !== "outbound",
  );

  checks.push({
    details:
      invalidBridgeDirections.length === 0
        ? "all bridge directions are inbound/outbound"
        : `${invalidBridgeDirections.length.toString()} invalid bridge direction rows`,
    name: "bridge semantic directions are valid",
    status: invalidBridgeDirections.length === 0 ? "PASS" : "FAIL",
  });

  checks.push({
    details:
      bridgeFlows.length === 0
        ? "no semantic bridge events in this window"
        : `${bridgeFlows.length.toString()} bridge flow groups found`,
    name: "bridge events are inspected separately from ERC20 transfer reconciliation",
    status: bridgeFlows.length === 0 ? "WARN" : "PASS",
  });

  return checks;
};

export const buildReconcileReport = async (
  db: ReadOnlyDb,
  args: InspectionArgs,
): Promise<EmptyReport | ReconcileReport> => {
  const window = await getRequiredWindow(db, args, "reconcile");

  if ("message" in window) {
    return window;
  }

  const [rawTransfers, volumeBuckets, entityFlowMetrics, entityPairFlowMetrics, bridgeFlows] =
    await Promise.all([
      getRawTransferMetrics(db, window),
      getVolumeBucketMetrics(db, window),
      getEntityFlowMetrics(db, window),
      getEntityPairFlowMetrics(db, window),
      getBridgeFlows(db, window, args.limit),
    ]);

  return {
    bridgeFlows,
    checks: buildReconciliationChecks({
      bridgeFlows,
      entityFlowMetrics,
      entityPairFlowMetrics,
      rawTransfers,
      volumeBuckets,
    }),
    entityFlowMetrics,
    entityPairFlowMetrics,
    generatedAt: new Date().toISOString(),
    kind: "reconcile",
    rawTransfers,
    volumeBuckets,
    window,
  };
};
