import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { z } from "zod";
import { describeError } from "../src/utils/describe-error.js";
import { type ArchiveCycleReport, expireArchivedEvents, runArchiveCycle } from "./cycle.js";
import { ensureArchiveTables } from "./tables.js";

const { Pool } = pg;

const schemaName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,44}$/, "Must be a schema name");

const env = z
  .object({
    DATABASE_URL: z.string().url(),
    /** The Ponder views schema the live indexer deployment publishes. */
    DATABASE_LIVE_SCHEMA: schemaName.default("stableflow"),
    ARCHIVE_INTERVAL_MS: z.coerce.number().int().min(500).max(60_000).default(2_000),
    RAW_RETENTION_HOURS: z.coerce
      .number()
      .positive()
      .default(14 * 24),
  })
  .parse(process.env);

const labelSyncIntervalMs = 30_000;
const retentionIntervalMs = 60 * 60_000;
const reportIntervalMs = 60_000;

// Railway displays the `message` and `level` fields of JSON log lines.
const log = (fields: { status: string } & Record<string, unknown>) =>
  console.log(
    JSON.stringify({
      level: fields.status === "failed" || fields.status === "pool_error" ? "error" : "info",
      message: `Archive ${fields.status}${typeof fields.error === "string" ? `: ${fields.error}` : ""}`,
      kind: "archive",
      timestamp: new Date().toISOString(),
      ...fields,
    }),
  );

const addCounts = (total: Record<string, number>, counts: Record<string, number>) => {
  for (const [table, count] of Object.entries(counts)) {
    total[table] = (total[table] ?? 0) + count;
  }
};

const run = async () => {
  const shutdown = new AbortController();
  process.on("SIGINT", () => shutdown.abort());
  process.on("SIGTERM", () => shutdown.abort());

  const pool = new Pool({
    application_name: "stableflow-archiver",
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    max: 2,
  });
  pool.on("error", (error) => log({ status: "pool_error", error: describeError(error) }));

  let tablesReady = false;

  let lastLabelSyncAt = 0;
  let lastRetentionAt = 0;
  let lastReportAt = Date.now();
  let lastCycle: ArchiveCycleReport | null = null;
  const copied: Record<string, number> = {};
  const removed: Record<string, number> = {};

  while (!shutdown.signal.aborted) {
    const startedAt = Date.now();

    try {
      // Inside the loop: the database can be unreachable for a while after a start.
      if (!tablesReady) {
        await ensureArchiveTables((sql) => pool.query(sql));
        tablesReady = true;
        log({ status: "started", liveSchema: env.DATABASE_LIVE_SCHEMA });
      }

      const client = await pool.connect();

      try {
        const includeLabels = startedAt - lastLabelSyncAt >= labelSyncIntervalMs;
        const report = await runArchiveCycle(client, {
          includeLabels,
          liveSchema: env.DATABASE_LIVE_SCHEMA,
        });

        if (report !== null) {
          lastCycle = report;
          addCounts(copied, report.copied);
          addCounts(removed, report.removed);
          if (includeLabels) lastLabelSyncAt = startedAt;

          if (startedAt - lastRetentionAt >= retentionIntervalMs) {
            const expired = await expireArchivedEvents(client, {
              latestBlock: BigInt(report.finalizedBlock),
              retentionHours: env.RAW_RETENTION_HOURS,
            });
            lastRetentionAt = startedAt;
            log({ status: "expired", ...expired });
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      log({ status: "failed", error: describeError(error) });
    }

    if (Date.now() - lastReportAt >= reportIntervalMs) {
      log({
        status: lastCycle === null ? "waiting" : "running",
        finalizedBlock: lastCycle?.finalizedBlock ?? null,
        copiedLastMinute: copied,
        removedLastMinute: removed,
      });
      lastReportAt = Date.now();
      for (const table of Object.keys(copied)) copied[table] = 0;
      for (const table of Object.keys(removed)) removed[table] = 0;
    }

    const wait = Math.max(0, env.ARCHIVE_INTERVAL_MS - (Date.now() - startedAt));
    await delay(wait, undefined, { signal: shutdown.signal }).catch(() => undefined);
  }

  await pool.end();
};

run().catch((error: unknown) => {
  log({ status: "failed", error: describeError(error) });
  process.exitCode = 1;
});
