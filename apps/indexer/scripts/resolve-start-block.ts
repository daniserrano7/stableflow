import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { z } from "zod";
import { archiveTables } from "../src/storage/schemas.js";
import { describeError } from "../src/utils/describe-error.js";
import { chooseStartBlock } from "./start-block.js";

// Prints the start block for a new deployment schema. Every start gets a fresh schema
// (see start-production.sh), so this also empties Ponder's sync tables: with the RPC
// cache disabled Ponder writes backfilled blocks there but never reads them again.
// Logs go to stderr as JSON with `level` and `message`, which Railway displays; stdout only
// carries the result for the start script.

const connectTimeoutMs = 5_000;
const connectRetryMs = 2_000;
const connectAttempts = 30;
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

const log = (level: "info" | "warn" | "error", message: string, fields = {}) =>
  console.error(JSON.stringify({ level, message, ...fields }));

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_SCHEMA: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,44}$/),
  PONDER_DISCOVERY_START_BLOCK_8453: z
    .string()
    .regex(/^\d+$/, "Must be a block number")
    .transform((value) => BigInt(value))
    .optional(),
  PONDER_RPC_URL_8453: z.string().url(),
});

const readEnv = () => {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment variables: ${issues.join(", ")}`);
};

// The private network can take a few seconds to route after the container starts.
const connect = async (connectionString: string) => {
  for (let attempt = 1; ; attempt++) {
    const client = new pg.Client({
      application_name: "stableflow-indexer-start-block",
      connectionString,
      connectionTimeoutMillis: connectTimeoutMs,
    });

    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => undefined);
      if (attempt >= connectAttempts) throw error;
      log("warn", `Database not reachable yet (attempt ${attempt}): ${describeError(error)}`);
      await delay(connectRetryMs);
    }
  }
};

const readHeadBlock = async (rpcUrl: string) => {
  const response = await fetch(rpcUrl, {
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
    log("info", "Cleared Ponder's sync cache");
  } catch (error) {
    // Missing on a fresh database, or locked: the next start tries again.
    log("warn", `Kept Ponder's sync cache: ${describeError(error)}`);
  }
};

const run = async () => {
  const env = readEnv();
  const client = await connect(env.DATABASE_URL);

  try {
    await clearPonderSyncCache(client);

    const choice = chooseStartBlock({
      archivedMaxBlock: await readArchivedMaxBlock(client),
      headBlock: await readHeadBlock(env.PONDER_RPC_URL_8453),
      initialStartBlock: env.PONDER_DISCOVERY_START_BLOCK_8453,
    });
    log("info", `New deployment starts at block ${choice.startBlock} (${choice.source})`, {
      schema: env.DATABASE_SCHEMA,
    });
    console.log(choice.startBlock.toString());
  } finally {
    await client.end();
  }
};

run().catch((error: unknown) => {
  log("error", `Start block resolution failed: ${describeError(error)}`);
  process.exitCode = 1;
});
