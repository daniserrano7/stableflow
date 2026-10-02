import pg from "pg";
import { z } from "zod";
import { archiveTables, indexerStateSchema, indexerStateTables } from "../src/storage/schemas.js";
import { chooseStartBlock } from "./start-block.js";

// Prints the start block for this deployment's schema. A restart must reuse the block the
// deployment was created with, or Ponder sees a different app and refuses the schema.
const env = z
  .object({
    DATABASE_URL: z.string().url(),
    DATABASE_SCHEMA: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,44}$/),
    PONDER_DISCOVERY_START_BLOCK_8453: z
      .string()
      .regex(/^\d+$/)
      .transform((value) => BigInt(value))
      .optional(),
  })
  .parse(process.env);

const undefinedTableErrorCode = "42P01";

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

const readRecordedStartBlock = async (client: pg.Client) => {
  const result = await client.query<{ start_block: string }>(
    `select start_block::text from ${indexerStateTables.deployments} where schema_name = $1`,
    [env.DATABASE_SCHEMA],
  );
  const startBlock = result.rows[0]?.start_block;
  return startBlock === undefined ? null : BigInt(startBlock);
};

const run = async () => {
  const client = new pg.Client({
    application_name: "stableflow-indexer-start-block",
    connectionString: env.DATABASE_URL,
  });
  await client.connect();

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

    const recorded = await readRecordedStartBlock(client);
    if (recorded !== null) {
      console.error(
        JSON.stringify({ kind: "start_block", source: "recorded", startBlock: `${recorded}` }),
      );
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
    const startBlock = (await readRecordedStartBlock(client)) ?? choice.startBlock;
    console.error(
      JSON.stringify({ kind: "start_block", source: choice.source, startBlock: `${startBlock}` }),
    );
    console.log(startBlock.toString());
  } finally {
    await client.end();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
