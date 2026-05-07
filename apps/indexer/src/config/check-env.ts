import { env } from "./env.js";

console.log("Indexer environment is valid", {
  PONDER_RPC_URL_8453: env.PONDER_RPC_URL_8453.length > 0,
});
