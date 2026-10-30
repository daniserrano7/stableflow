import { indexer } from "envio";
import { latestBlockTimestamp } from "../lib/clock";

/** Pruning runs every 150 Base blocks (5 minutes), like Ponder's LiveRetention handler. */
const RETENTION_INTERVAL_BLOCKS = 150;

// Unset keeps everything. Ponder's version also waits for the archive to hold the rows
// first (it reads stableflow_archive); there is no archive here, so only set this when
// something else already copies the rows you need.
const retentionSeconds = process.env.ENVIO_LIVE_RETENTION_HOURS
  ? BigInt(Math.floor(Number(process.env.ENVIO_LIVE_RETENTION_HOURS) * 3600))
  : undefined;

indexer.onBlock(
  {
    name: "LiveRetention",
    where: () =>
      retentionSeconds === undefined
        ? false
        : { block: { number: { _gte: indexer.chains[8453].startBlock, _every: RETENTION_INTERVAL_BLOCKS } } },
  },
  async ({ context }) => {
    if (context.isPreload || retentionSeconds === undefined) return;

    // Block handlers carry no timestamp; use the newest one a Transfer handler has seen.
    const newest = latestBlockTimestamp();
    if (newest === undefined) return;
    const cutoff = newest - retentionSeconds;

    for (const row of await context.Usdc_transfers.getWhere({ block_timestamp: { _lt: cutoff } })) {
      context.Usdc_transfers.deleteUnsafe(row.id);
    }
    for (const row of await context.Usdc_bridge_events.getWhere({ block_timestamp: { _lt: cutoff } })) {
      context.Usdc_bridge_events.deleteUnsafe(row.id);
    }
    for (const row of await context.Usdc_transfer_volume_buckets.getWhere({ bucket_start: { _lt: cutoff } })) {
      context.Usdc_transfer_volume_buckets.deleteUnsafe(row.id);
    }
    for (const row of await context.Usdc_entity_flow_buckets.getWhere({ bucket_start: { _lt: cutoff } })) {
      context.Usdc_entity_flow_buckets.deleteUnsafe(row.id);
    }
    for (const row of await context.Usdc_entity_pair_flow_buckets.getWhere({ bucket_start: { _lt: cutoff } })) {
      context.Usdc_entity_pair_flow_buckets.deleteUnsafe(row.id);
    }
    for (const row of await context.Usdc_bridge_flow_buckets.getWhere({ bucket_start: { _lt: cutoff } })) {
      context.Usdc_bridge_flow_buckets.deleteUnsafe(row.id);
    }
  },
);
