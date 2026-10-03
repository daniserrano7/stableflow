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
    connectionTimeoutMillis: 10_000,
    max: 1,
  });

  try {
    return (await pool.query<Row>(text, values)).rows;
  } catch (error) {
    if ((error as { code?: unknown }).code === undefinedTableErrorCode) return null;
    throw error;
  }
};

/** Block time of the newest archived transfer, or null while the archive is empty. */
export const readArchivedThroughTimestamp = async () => {
  const rows = await queryArchive<{ block_timestamp: string }>(
    `
      select block_timestamp::text
      from ${archiveTables.usdcTransfers}
      order by block_number desc
      limit 1
    `,
  );
  const timestamp = rows?.[0]?.block_timestamp;

  return timestamp === undefined ? null : BigInt(timestamp);
};
