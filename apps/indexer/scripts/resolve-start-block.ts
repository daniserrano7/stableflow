import pg from "pg";
import { z } from "zod";
import { archiveTables } from "../src/storage/schemas.js";
import { chooseStartBlock } from "./start-block.js";

// Prints the start block for a new deployment schema. Every start gets a fresh schema
// (see start-production.sh), so this also empties Ponder's sync tables: with the RPC
// cache disabled Ponder writes backfilled blocks there but never reads them again.
const env = z
  .object({
    DATABASE_URL: z.string().url(),
    PONDER_DISCOVERY_START_BLOCK_8453: z
      .string()
      .regex(/^\d+$/)
      .transform((value) => BigInt(value))
      .optional(),
    PONDER_RPC_URL_8453: z.string().url(),
  })
  .parse(process.env);

const undefinedTableErrorCode = "42P01";

/** Backfill data only; factory addresses and intervals are small and left alone. */
const ponderSyncCacheTables = [
  "blocks",
  "transactions",
  "transaction_receipts",
  "logs",
  "traces",
  "rpc_request_results",
].map((table) => `ponder_sync.${table}`);

const log = (fields: Record<string, unknown>) =>
  console.error(JSON.stringify({ kind: "start_block", ...fields }));

const readHeadBlock = async () => {
  const response = await fetch(env.PONDER_RPC_URL_8453, {
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "eth_blockNumber", params: [] }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as { result?: string };
  if (body.result === undefined) throw new Error(`eth_blockNumber failed: ${response.status}`);
  return BigInt(body.result);
};

const readArchivedMaxBlock = async (client: pg.Client) => {
  try {
    const result = await client.query<{ max: string | null }>(
      `select max(block_number)::text as max from ${archiveTables.usdcTransfers}`,
    );
    const max = result.rows[0]?.max ?? null;
    return max === null ? null : BigInt(max);
  } catch (error) {
    if ((error as { code?: unknown }).code === undefinedTableErrorCode) return null;
    throw error;
  }
};

const clearPonderSyncCache = async (client: pg.Client) => {
  try {
    // A previous deployment may still hold these tables; don't wait on it.
    await client.query("set lock_timeout = '10s'");
    await client.query(`truncate ${ponderSyncCacheTables.join(", ")}`);
    log({ status: "sync_cache_cleared" });
  } catch (error) {
    // Missing on a fresh database, or locked: the next start tries again.
    log({ status: "sync_cache_kept", error: error instanceof Error ? error.message : error });
  }
};

const run = async () => {
  const client = new pg.Client({
    application_name: "stableflow-indexer-start-block",
    connectionString: env.DATABASE_URL,
  });
  await client.connect();

  try {
    await clearPonderSyncCache(client);

    const choice = chooseStartBlock({
      archivedMaxBlock: await readArchivedMaxBlock(client),
      headBlock: await readHeadBlock(),
      initialStartBlock: env.PONDER_DISCOVERY_START_BLOCK_8453,
    });
    log({ source: choice.source, startBlock: `${choice.startBlock}` });
    console.log(choice.startBlock.toString());
  } finally {
    await client.end();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
