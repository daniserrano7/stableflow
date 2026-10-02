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
import { liveRetentionSeconds } from "../retention/live-retention.js";

// The archive keeps history. A deployment only needs recent rows for the live stream and
// as a buffer while the archiver catches up. Cutoffs follow block time, so re-indexing
// prunes the same rows, and Ponder tracks these deletes for reorgs.
ponder.on("LiveRetention:block", async ({ event, context }) => {
  if (liveRetentionSeconds === undefined) return;

  const cutoff = event.block.timestamp - liveRetentionSeconds;

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
