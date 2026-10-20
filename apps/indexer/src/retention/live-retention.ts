import { env } from "../env/env.js";

/** Pruning runs every 150 Base blocks (5 minutes). */
export const liveRetentionIntervalBlocks = 150;

/** Undefined keeps everything, e.g. local development without an archive. */
export const liveRetentionSeconds =
  env.LIVE_RETENTION_HOURS === undefined
    ? undefined
    : BigInt(Math.floor(env.LIVE_RETENTION_HOURS * 3600));
