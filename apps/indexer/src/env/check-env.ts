import { env } from "./env.js";

console.log("Indexer environment is valid", {
  DATABASE_URL: env.DATABASE_URL.length > 0,
  PONDER_DISCOVERY_START_BLOCK_8453: env.PONDER_DISCOVERY_START_BLOCK_8453 ?? "latest",
  PONDER_RPC_URL_8453: env.PONDER_RPC_URL_8453.length > 0,
});
