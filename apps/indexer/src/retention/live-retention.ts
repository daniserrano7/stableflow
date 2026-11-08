import { baseBlocksIn } from "../chains/base-block-time.js";
import { env } from "../env/env.js";

/** Pruning runs every 5 minutes of Base blocks. */
export const liveRetentionIntervalBlocks = baseBlocksIn(5 * 60);

/** Undefined keeps everything, e.g. local development without an archive. */
export const liveRetentionSeconds =
  env.LIVE_RETENTION_HOURS === undefined
    ? undefined
    : BigInt(Math.floor(env.LIVE_RETENTION_HOURS * 3600));
