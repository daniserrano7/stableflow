import { opsTables } from "../src/ops/schema.js";
import { parseInspectionArgs } from "./args.js";
import { createReadOnlyDb } from "./db.js";
import { printJson } from "./reporting.js";

type DiscoveryRunRow = {
  candidate_count: number;
  duration_ms: number;
  finished_at: Date;
  first_observed_block: string | null;
  indexed_transfers: string;
  latest_block: string;
  promoted_count: number;
  promoted_touch_share_bps: number;
  restored_count: number;
  scanned_count: number;
  unidentified_directional_share_bps: number;
  verified_count: number;
};

const run = async () => {
  const args = parseInspectionArgs();
  const db = createReadOnlyDb();

  try {
    const [table] = await db.query<{ exists: boolean }>(
      `select to_regclass('${opsTables.addressLabelDiscoveryRuns}') is not null as exists`,
    );

    if (!table?.exists) {
      console.log("No discovery runs recorded yet.");
      return;
    }

    const rows = await db.query<DiscoveryRunRow>(
      `
        select finished_at, first_observed_block::text, latest_block::text, indexed_transfers::text,
          scanned_count, verified_count, promoted_count, restored_count, candidate_count,
          promoted_touch_share_bps, unidentified_directional_share_bps, duration_ms
        from ${opsTables.addressLabelDiscoveryRuns}
        order by id desc
        limit $1::integer
      `,
      [args.limit],
    );

    if (args.json) {
      printJson(rows);
      return;
    }

    for (const row of rows) {
      console.log(
        `${row.finished_at.toISOString()} | blocks=${row.first_observed_block ?? "?"}-${row.latest_block} | scanned=${row.scanned_count} | verified=${row.verified_count} | promoted=${row.promoted_count} | restored=${row.restored_count} | pending=${row.candidate_count} | promoted touch=${(row.promoted_touch_share_bps / 100).toFixed(2)}% | unidentified=${(row.unidentified_directional_share_bps / 100).toFixed(2)}% | ${row.duration_ms}ms`,
      );
    }
  } finally {
    await db.close();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
