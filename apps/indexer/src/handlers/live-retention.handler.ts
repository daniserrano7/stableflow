import { ponder } from "ponder:registry";
import {
  usdcBridgeEvents,
  usdcBridgeFlowBuckets,
  usdcEntityFlowBuckets,
  usdcEntityPairFlowBuckets,
  usdcTransfers,
  usdcTransferVolumeBuckets,
} from "ponder:schema";
import { lt } from "drizzle-orm";
import { getLiveRetentionCutoff } from "../retention/cutoff.js";
import { liveRetentionSeconds } from "../retention/live-retention.js";
import { readArchivedThroughTimestamp } from "../storage/archive-db.js";

// The archive keeps history; a deployment only needs recent rows for the live stream.
// Pruning never passes what the archive already holds, so a long backfill or an archiver
// outage only grows these tables until it catches up. Ponder tracks the deletes for
// reorgs; which rows a re-index prunes may differ, which only affects storage.
ponder.on("LiveRetention:block", async ({ event, context }) => {
  if (liveRetentionSeconds === undefined) return;

  const cutoff = getLiveRetentionCutoff({
    archivedThroughTimestamp: await readArchivedThroughTimestamp(),
    blockTimestamp: event.block.timestamp,
    retentionSeconds: liveRetentionSeconds,
  });
  if (cutoff === null) return;

  await context.db.sql.delete(usdcTransfers).where(lt(usdcTransfers.blockTimestamp, cutoff));
  await context.db.sql.delete(usdcBridgeEvents).where(lt(usdcBridgeEvents.blockTimestamp, cutoff));
  await context.db.sql
    .delete(usdcTransferVolumeBuckets)
    .where(lt(usdcTransferVolumeBuckets.bucketStart, cutoff));
  await context.db.sql
    .delete(usdcEntityFlowBuckets)
    .where(lt(usdcEntityFlowBuckets.bucketStart, cutoff));
  await context.db.sql
    .delete(usdcEntityPairFlowBuckets)
    .where(lt(usdcEntityPairFlowBuckets.bucketStart, cutoff));
  await context.db.sql
    .delete(usdcBridgeFlowBuckets)
    .where(lt(usdcBridgeFlowBuckets.bucketStart, cutoff));
});
