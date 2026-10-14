import pg from "pg";
import { env } from "../env/env.js";
import { archiveTables } from "./schemas.js";

const { Pool } = pg;

const undefinedTableErrorCode = "42P01";

let pool: pg.Pool | null = null;

/** Read-only access to the archive from the indexer. Null when the archive doesn't exist yet. */
export const queryArchive = async <Row extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<Row[] | null> => {
  pool ??= new Pool({
    application_name: "stableflow-indexer-archive",
    connectionString: env.DATABASE_URL,
    max: 1,
  });

  try {
    return (await pool.query<Row>(text, values)).rows;
  } catch (error) {
    if ((error as { code?: unknown }).code === undefinedTableErrorCode) return null;
    throw error;
  }
};

/**
 * Block time of the newest archived transfer, or null while the archive is empty or
 * unreachable: pruning then waits for the next run instead of crashing the indexer.
 */
export const readArchivedThroughTimestamp = async () => {
  const rows = await queryArchive<{ block_timestamp: string }>(
    `
      select block_timestamp::text
      from ${archiveTables.usdcTransfers}
      order by block_number desc
      limit 1
    `,
  ).catch((error: unknown) => {
    console.warn(
      JSON.stringify({
        kind: "live_retention",
        status: "skipped",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  });
  const timestamp = rows?.[0]?.block_timestamp;

  return timestamp === undefined ? null : BigInt(timestamp);
};
