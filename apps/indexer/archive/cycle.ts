import type pg from "pg";
import { type ArchivedTable, archivedTables } from "./tables.js";

const baseChainId = 8453;
// Base (OP Stack) produces a block every 2 seconds.
const baseBlockSeconds = 2n;
const bucketSeconds = 60n;
const retentionBatchSize = 10_000;
const archiveLockKey = [8453, 2] as const;
const undefinedTableErrorCode = "42P01";

export type ArchiveCycleReport = {
  copied: Record<string, number>;
  finalizedBlock: string;
  removed: Record<string, number>;
};

/** Ponder checkpoints are fixed-width: timestamp (10), chain ID (16), block number (16), ... */
export const decodeCheckpoint = (checkpoint: string) => ({
  blockNumber: BigInt(checkpoint.slice(26, 42)),
  blockTimestamp: BigInt(checkpoint.slice(0, 10)),
});

/**
 * Where to start copying buckets. Minutes before the live deployment's first complete
 * minute keep their archived values: a new deployment only saw part of its first minute.
 */
export const getBucketCopyStart = ({
  archivedMax,
  finalizedTimestamp,
  liveFirstBucket,
}: {
  archivedMax: bigint | null;
  finalizedTimestamp: bigint;
  liveFirstBucket: bigint | null;
}) => {
  if (archivedMax === null) return -1n;

  const finalizedMinute = finalizedTimestamp - (finalizedTimestamp % bucketSeconds);
  const unsettledStart = finalizedMinute - bucketSeconds;
  const start = archivedMax < unsettledStart ? archivedMax : unsettledStart;
  const firstCompleteMinute = liveFirstBucket === null ? null : liveFirstBucket + bucketSeconds;

  return firstCompleteMinute !== null && firstCompleteMinute > start ? firstCompleteMinute : start;
};

export const getRetentionCutoffBlock = (latestBlock: bigint, retentionHours: number) =>
  latestBlock - BigInt(Math.floor((retentionHours * 3600) / Number(baseBlockSeconds)));

const toBigIntOrNull = (value: string | null) => (value === null ? null : BigInt(value));

const upsertSql = (table: ArchivedTable, liveSchema: string, where: string) => {
  const columns = table.columns.join(", ");
  const updated = table.columns.filter((column) => !table.primaryKey.includes(column));

  return `
    insert into ${table.qualifiedName} (${columns})
    select ${columns} from ${liveSchema}.${table.name}
    where ${where}
    on conflict (${table.primaryKey.join(", ")}) do update
    set ${updated.map((column) => `${column} = excluded.${column}`).join(", ")}
    where (${updated.map((column) => `${table.name}.${column}`).join(", ")})
      is distinct from (${updated.map((column) => `excluded.${column}`).join(", ")})
  `;
};

const readFinalizedCheckpoint = async (client: pg.ClientBase, liveSchema: string) => {
  try {
    const result = await client.query<{ finalized_checkpoint: string }>(
      `select finalized_checkpoint from ${liveSchema}._ponder_checkpoint where chain_id = $1`,
      [baseChainId],
    );
    const checkpoint = result.rows[0]?.finalized_checkpoint;
    return checkpoint === undefined ? null : decodeCheckpoint(checkpoint);
  } catch (error) {
    // The views only exist once an indexer deployment has reached realtime.
    if ((error as { code?: unknown }).code === undefinedTableErrorCode) return null;
    throw error;
  }
};

const copyEvents = async (
  client: pg.ClientBase,
  table: ArchivedTable,
  liveSchema: string,
  finalizedBlock: bigint,
) => {
  const [archived] = (
    await client.query<{ max: string | null }>(
      `select max(block_number)::text as max from ${table.qualifiedName}`,
    )
  ).rows;
  const archivedMax = toBigIntOrNull(archived?.max ?? null);
  // Unfinalized blocks are copied again every cycle so reorgs settle into the archive.
  const from =
    archivedMax === null ? -1n : archivedMax < finalizedBlock ? archivedMax : finalizedBlock;

  const copied = await client.query(upsertSql(table, liveSchema, "block_number > $1"), [
    from.toString(),
  ]);
  const removed = await client.query(
    `
      delete from ${table.qualifiedName} archived
      where archived.block_number > $1
        and not exists (
          select 1 from ${liveSchema}.${table.name} live
          where ${table.primaryKey.map((column) => `live.${column} = archived.${column}`).join(" and ")}
        )
    `,
    [finalizedBlock.toString()],
  );

  return { copied: copied.rowCount ?? 0, removed: removed.rowCount ?? 0 };
};

const copyBuckets = async (
  client: pg.ClientBase,
  table: ArchivedTable,
  liveSchema: string,
  finalizedTimestamp: bigint,
  liveFirstBucket: bigint | null,
) => {
  const [archived] = (
    await client.query<{ max: string | null }>(
      `select max(bucket_start)::text as max from ${table.qualifiedName}`,
    )
  ).rows;
  const start = getBucketCopyStart({
    archivedMax: toBigIntOrNull(archived?.max ?? null),
    finalizedTimestamp,
    liveFirstBucket,
  });
  const copied = await client.query(upsertSql(table, liveSchema, "bucket_start >= $1"), [
    start.toString(),
  ]);

  return { copied: copied.rowCount ?? 0, removed: 0 };
};

const copyLabels = async (client: pg.ClientBase, table: ArchivedTable, liveSchema: string) => {
  const columns = table.columns.join(", ");
  const copied = await client.query(`
    insert into ${table.qualifiedName} (${columns})
    select ${columns} from ${liveSchema}.${table.name}
    on conflict (${table.primaryKey.join(", ")}) do nothing
  `);

  return { copied: copied.rowCount ?? 0, removed: 0 };
};

/**
 * Mirrors the live indexer views into the archive in one transaction. Returns null when
 * there is nothing to copy yet or another archiver holds the lock.
 */
export const runArchiveCycle = async (
  client: pg.ClientBase,
  { includeLabels, liveSchema }: { includeLabels: boolean; liveSchema: string },
): Promise<ArchiveCycleReport | null> => {
  const finalized = await readFinalizedCheckpoint(client, liveSchema);
  if (finalized === null) return null;

  await client.query("begin");

  try {
    const [lock] = (
      await client.query<{ acquired: boolean }>(
        "select pg_try_advisory_xact_lock($1, $2) as acquired",
        [...archiveLockKey],
      )
    ).rows;

    if (lock?.acquired !== true) {
      await client.query("rollback");
      return null;
    }

    // Base has transfers every minute, so the live deployment's first volume bucket is
    // the (possibly partial) minute it started in.
    const [liveCoverage] = (
      await client.query<{ min: string | null }>(
        `select min(bucket_start)::text as min from ${liveSchema}.usdc_transfer_volume_buckets`,
      )
    ).rows;
    const liveFirstBucket = toBigIntOrNull(liveCoverage?.min ?? null);
    const report: ArchiveCycleReport = {
      copied: {},
      finalizedBlock: finalized.blockNumber.toString(),
      removed: {},
    };

    for (const table of archivedTables) {
      const result =
        table.kind === "event"
          ? await copyEvents(client, table, liveSchema, finalized.blockNumber)
          : table.kind === "bucket"
            ? await copyBuckets(
                client,
                table,
                liveSchema,
                finalized.blockTimestamp,
                liveFirstBucket,
              )
            : includeLabels
              ? await copyLabels(client, table, liveSchema)
              : { copied: 0, removed: 0 };

      report.copied[table.name] = result.copied;
      report.removed[table.name] = result.removed;
    }

    await client.query("commit");
    return report;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};

/** Deletes archived events older than the retention window, in batches. */
export const expireArchivedEvents = async (
  client: pg.ClientBase,
  { latestBlock, retentionHours }: { latestBlock: bigint; retentionHours: number },
) => {
  const cutoff = getRetentionCutoffBlock(latestBlock, retentionHours);
  const removed: Record<string, number> = {};

  for (const table of archivedTables.filter((candidate) => candidate.kind === "event")) {
    let tableRemoved = 0;

    for (;;) {
      const result = await client.query(
        `
          delete from ${table.qualifiedName}
          where ctid = any(array(
            select ctid from ${table.qualifiedName} where block_number < $1 limit $2
          ))
        `,
        [cutoff.toString(), retentionBatchSize],
      );
      const count = result.rowCount ?? 0;
      tableRemoved += count;
      if (count < retentionBatchSize) break;
    }

    removed[table.name] = tableRemoved;
  }

  return { cutoffBlock: cutoff.toString(), removed };
};
