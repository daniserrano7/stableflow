import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { z } from "zod";
import { archiveTables, indexerStateSchema, indexerStateTables } from "../src/storage/schemas.js";
import { describeError } from "../src/utils/describe-error.js";
import { chooseStartBlock } from "./start-block.js";

// Prints the start block for this deployment's schema. A restart must reuse the block the
// deployment was created with, or Ponder sees a different app and refuses the schema.
// Logs go to stderr as JSON with `level` and `message`, which Railway displays; stdout only
// carries the result for the start script.

const connectTimeoutMs = 5_000;
const connectRetryMs = 2_000;
const connectAttempts = 30;
const undefinedTableErrorCode = "42P01";

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

const readRecordedStartBlock = async (client: pg.Client, schemaName: string) => {
  const result = await client.query<{ start_block: string }>(
    `select start_block::text from ${indexerStateTables.deployments} where schema_name = $1`,
    [schemaName],
  );
  const startBlock = result.rows[0]?.start_block;
  return startBlock === undefined ? null : BigInt(startBlock);
};

const run = async () => {
  const env = readEnv();
  const client = await connect(env.DATABASE_URL);

  try {
    await client.query(`
      do $$
      begin
        if to_regnamespace('${indexerStateSchema}') is null then
          create schema ${indexerStateSchema};
        end if;
      end
      $$
    `);
    await client.query(`
      create table if not exists ${indexerStateTables.deployments} (
        schema_name text primary key,
        start_block bigint not null,
        created_at timestamptz not null default now()
      )
    `);

    const recorded = await readRecordedStartBlock(client, env.DATABASE_SCHEMA);
    if (recorded !== null) {
      log("info", `Resuming from recorded start block ${recorded}`, {
        schema: env.DATABASE_SCHEMA,
      });
      console.log(recorded.toString());
      return;
    }

    const choice = chooseStartBlock({
      archivedMaxBlock: await readArchivedMaxBlock(client),
      initialStartBlock: env.PONDER_DISCOVERY_START_BLOCK_8453,
    });
    await client.query(
      `
        insert into ${indexerStateTables.deployments} (schema_name, start_block)
        values ($1, $2)
        on conflict (schema_name) do nothing
      `,
      [env.DATABASE_SCHEMA, choice.startBlock.toString()],
    );
    // Another starting instance may have won the insert; its block is the one to use.
    const startBlock =
      (await readRecordedStartBlock(client, env.DATABASE_SCHEMA)) ?? choice.startBlock;
    log("info", `New deployment starts at block ${startBlock} (${choice.source})`, {
      schema: env.DATABASE_SCHEMA,
    });
    console.log(startBlock.toString());
  } finally {
    await client.end();
  }
};

run().catch((error: unknown) => {
  log("error", `Start block resolution failed: ${describeError(error)}`);
  process.exitCode = 1;
});
