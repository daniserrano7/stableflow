import type { InspectionArgs } from "./args.js";
import { verifyCandidate } from "./candidate-verifiers.js";
import {
  ensureAddressLabelCandidateReviewsTable,
  getFallbackCandidateVerification,
  getUnidentifiedAddressCandidates,
  getVerifiedMissingLabels,
  isAutoPromotable,
  promoteVerifiedCandidates,
  upsertAddressLabelCandidate,
} from "./candidates.js";
import { verifyKnownCounterpartyPattern } from "./counterparty-pattern-verifier.js";
import type { OperatorDb } from "./db.js";
import { getEntityFlowMetrics, getRawTransferMetrics } from "./queries.js";

export type DiscoveryReport = {
  candidateCount: number;
  durationMs: number;
  finishedAt: string;
  firstObservedBlock: string | null;
  indexedTransfers: string | null;
  kind: "label_discovery";
  latestBlock: string | null;
  promotedCount: number;
  promotedTouchValue: string;
  promotedTouchShareBps: number;
  rawTransferValue: string;
  restoredCount: number;
  scannedCount: number;
  scannedTouchShareBps: number;
  status: "completed" | "empty" | "locked";
  unidentifiedDirectionalShareBps: number;
  verifiedCount: number;
  windowEnd: string | null;
  windowStart: string | null;
};

const discoveryLockKey = [8453, 1] as const;

const toBasisPoints = (part: bigint, total: bigint) =>
  total === 0n ? 0 : Number((part * 10_000n) / total);

const emptyReport = (status: "empty" | "locked", startedAtMs: number): DiscoveryReport => ({
  candidateCount: 0,
  durationMs: Date.now() - startedAtMs,
  finishedAt: new Date().toISOString(),
  firstObservedBlock: null,
  indexedTransfers: null,
  kind: "label_discovery",
  latestBlock: null,
  promotedCount: 0,
  promotedTouchValue: "0",
  promotedTouchShareBps: 0,
  rawTransferValue: "0",
  restoredCount: 0,
  scannedCount: 0,
  scannedTouchShareBps: 0,
  status,
  unidentifiedDirectionalShareBps: 0,
  verifiedCount: 0,
  windowEnd: null,
  windowStart: null,
});

const ensureDiscoveryRunsTable = async (db: OperatorDb) => {
  await db.execute(`
    create table if not exists address_label_discovery_runs (
      id bigserial primary key,
      started_at timestamptz not null,
      finished_at timestamptz not null,
      first_observed_block numeric,
      latest_block numeric not null,
      window_start numeric not null,
      window_end numeric not null,
      indexed_transfers numeric not null,
      scanned_count integer not null,
      verified_count integer not null,
      promoted_count integer not null,
      candidate_count integer not null,
      raw_transfer_value numeric not null,
      restored_count integer not null default 0,
      promoted_touch_value numeric not null,
      scanned_touch_share_bps integer not null,
      promoted_touch_share_bps integer not null,
      unidentified_directional_share_bps integer not null,
      duration_ms integer not null
    )
  `);

  await db.execute(`
    alter table address_label_discovery_runs
    add column if not exists restored_count integer not null default 0
  `);
  await db.execute(`
    alter table address_label_discovery_runs
    add column if not exists first_observed_block numeric
  `);
};

const saveDiscoveryReport = async (db: OperatorDb, startedAt: string, report: DiscoveryReport) => {
  if (report.status !== "completed") {
    return;
  }

  await ensureDiscoveryRunsTable(db);
  await db.execute(
    `
      insert into address_label_discovery_runs (
        started_at, finished_at, first_observed_block, latest_block, window_start, window_end,
        indexed_transfers, scanned_count, verified_count, promoted_count,
        candidate_count, raw_transfer_value, restored_count, promoted_touch_value,
        scanned_touch_share_bps, promoted_touch_share_bps,
        unidentified_directional_share_bps, duration_ms
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
    `,
    [
      startedAt,
      report.finishedAt,
      report.firstObservedBlock,
      report.latestBlock,
      report.windowStart,
      report.windowEnd,
      report.indexedTransfers,
      report.scannedCount,
      report.verifiedCount,
      report.promotedCount,
      report.candidateCount,
      report.rawTransferValue,
      report.restoredCount,
      report.promotedTouchValue,
      report.scannedTouchShareBps,
      report.promotedTouchShareBps,
      report.unidentifiedDirectionalShareBps,
      report.durationMs,
    ],
  );
};

export const runDiscovery = async (
  db: OperatorDb,
  args: InspectionArgs,
  options: { checkedCooldownMinutes?: number } = {},
): Promise<DiscoveryReport> => {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const releaseLock = await db.tryAdvisoryLock(...discoveryLockKey);

  if (releaseLock === null) {
    return emptyReport("locked", startedAtMs);
  }

  try {
    await ensureAddressLabelCandidateReviewsTable(db);
    const { candidates, window } = await getUnidentifiedAddressCandidates(db, args, options);

    if (window === null) {
      return emptyReport("empty", startedAtMs);
    }

    let verifiedCount = 0;

    for (const candidate of candidates) {
      const verification =
        (await verifyCandidate(candidate)) ??
        (await verifyKnownCounterpartyPattern(db, candidate)) ??
        getFallbackCandidateVerification(candidate);

      if (isAutoPromotable(verification)) {
        verifiedCount += 1;
      }

      await upsertAddressLabelCandidate({ candidate, db, verification });
    }

    // Older reviews relied on a pool's self-reported factory address. Recheck
    // them against the factory registry before restoring labels after a reset.
    const legacyReviews = await getVerifiedMissingLabels(db, 500, "onchain_pool_identity");
    const scannedAddresses = new Set(
      candidates.map((candidate) => candidate.address.toLowerCase()),
    );

    for (const candidate of legacyReviews) {
      if (scannedAddresses.has(candidate.address.toLowerCase())) {
        continue;
      }

      const verification =
        (await verifyCandidate(candidate)) ?? getFallbackCandidateVerification(candidate);
      await upsertAddressLabelCandidate({ candidate, db, verification });
    }

    const promoted = [];

    for (;;) {
      const batch = await promoteVerifiedCandidates(db, 500);
      promoted.push(...batch);

      if (batch.length < 500) {
        break;
      }
    }

    const [rawTransfers, entityFlows] = await Promise.all([
      getRawTransferMetrics(db, window),
      getEntityFlowMetrics(db, window),
    ]);
    const scannedTouchValue = candidates.reduce(
      (total, candidate) => total + candidate.totalTouchValue,
      0n,
    );
    const promotedAddresses = new Set(promoted.map((candidate) => candidate.address.toLowerCase()));
    const promotedTouchValue = candidates.reduce(
      (total, candidate) =>
        total +
        (promotedAddresses.has(candidate.address.toLowerCase()) ? candidate.totalTouchValue : 0n),
      0n,
    );
    const report: DiscoveryReport = {
      candidateCount: candidates.length - verifiedCount,
      durationMs: Date.now() - startedAtMs,
      finishedAt: new Date().toISOString(),
      firstObservedBlock: rawTransfers.minBlock?.toString() ?? null,
      indexedTransfers: window.totalIndexedTransfers.toString(),
      kind: "label_discovery",
      latestBlock: window.latestBlock.toString(),
      promotedCount: promoted.length,
      promotedTouchValue: promotedTouchValue.toString(),
      promotedTouchShareBps: toBasisPoints(promotedTouchValue, rawTransfers.totalValue * 2n),
      rawTransferValue: rawTransfers.totalValue.toString(),
      restoredCount: promoted.filter((candidate) => candidate.promotedAt !== null).length,
      scannedCount: candidates.length,
      scannedTouchShareBps: toBasisPoints(scannedTouchValue, rawTransfers.totalValue * 2n),
      status: "completed",
      unidentifiedDirectionalShareBps: toBasisPoints(
        entityFlows.unidentifiedValue,
        entityFlows.totalValue,
      ),
      verifiedCount,
      windowEnd: window.endEpochExclusive.toString(),
      windowStart: window.startEpoch.toString(),
    };

    await saveDiscoveryReport(db, startedAt, report);
    return report;
  } finally {
    await releaseLock();
  }
};
