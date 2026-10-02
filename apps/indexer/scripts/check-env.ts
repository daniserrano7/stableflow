import { env } from "../src/env/env.js";

console.log("Indexer environment is valid", {
  DATABASE_URL: env.DATABASE_URL.length > 0,
  DATABASE_SCHEMA: env.DATABASE_SCHEMA,
  DATABASE_VIEWS_SCHEMA: env.DATABASE_VIEWS_SCHEMA ?? "none",
  PONDER_DISCOVERY_START_BLOCK_8453: env.PONDER_DISCOVERY_START_BLOCK_8453 ?? "ponder-default",
  PONDER_RPC_URL_8453: env.PONDER_RPC_URL_8453.length > 0,
  PONDER_DISABLE_CACHE: env.PONDER_DISABLE_CACHE,
  LIVE_RETENTION_HOURS: env.LIVE_RETENTION_HOURS ?? "keep everything",
});
