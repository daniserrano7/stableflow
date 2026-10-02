import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import {
  discoveredAddressLabels,
  usdcBridgeEvents,
  usdcBridgeFlowBuckets,
  usdcEntityFlowBuckets,
  usdcEntityPairFlowBuckets,
  usdcTransfers,
  usdcTransferVolumeBuckets,
} from "../ponder.schema.js";
import { archiveSchema } from "../src/storage/schemas.js";

/**
 * - event: one row per onchain event, keyed by block; expires after the retention window.
 * - bucket: per-minute aggregates, kept forever.
 * - label: address labels, kept forever and fed back to new indexer deployments.
 */
export type ArchivedTableKind = "event" | "bucket" | "label";

export interface ArchivedTable {
  kind: ArchivedTableKind;
  name: string;
  qualifiedName: string;
  /** Columns shared with the indexer table, in indexer order. */
  columns: string[];
  primaryKey: string[];
  ddl: string[];
}

const labelArchivedAtIndex = "discovered_address_labels_archived_at_idx";

const describe = (table: PgTable, kind: ArchivedTableKind): ArchivedTable => {
  const config = getTableConfig(table);
  const qualifiedName = `${archiveSchema}.${config.name}`;
  const primaryKey =
    config.primaryKeys[0]?.columns.map((column) => column.name) ??
    config.columns.filter((column) => column.primary).map((column) => column.name);
  const columnSql = config.columns.map((column) => `${column.name} ${column.getSQLType()}`);
  const definitions = config.columns.map(
    (column, index) => `${columnSql[index]}${column.notNull ? " not null" : ""}`,
  );

  // Labels record when they were archived so indexer deployments can sync them incrementally.
  const labelDefinitions =
    kind === "label"
      ? ["archived_at bigint not null default extract(epoch from now())::bigint"]
      : [];

  return {
    kind,
    name: config.name,
    qualifiedName,
    columns: config.columns.map((column) => column.name),
    primaryKey,
    ddl: [
      `create table if not exists ${qualifiedName} (${[
        ...definitions,
        ...labelDefinitions,
        `primary key (${primaryKey.join(", ")})`,
      ].join(", ")})`,
      // New indexer columns arrive nullable; existing rows predate them.
      ...columnSql.map((sql) => `alter table ${qualifiedName} add column if not exists ${sql}`),
      ...config.indexes.map(
        (index) =>
          `create index if not exists ${index.config.name} on ${qualifiedName} (${index.config.columns
            .map((column) => ("name" in column ? column.name : ""))
            .join(", ")})`,
      ),
      ...(kind === "label"
        ? [`create index if not exists ${labelArchivedAtIndex} on ${qualifiedName} (archived_at)`]
        : []),
    ],
  };
};

export const archivedTables: ArchivedTable[] = [
  describe(usdcTransfers, "event"),
  describe(usdcBridgeEvents, "event"),
  describe(usdcTransferVolumeBuckets, "bucket"),
  describe(usdcEntityFlowBuckets, "bucket"),
  describe(usdcEntityPairFlowBuckets, "bucket"),
  describe(usdcBridgeFlowBuckets, "bucket"),
  describe(discoveredAddressLabels, "label"),
];

export const archivedLabelsTable = archivedTables.find(
  (table) => table.kind === "label",
) as ArchivedTable;

export const ensureArchiveTables = async (
  execute: (sql: string) => Promise<unknown>,
  tables: ArchivedTable[] = archivedTables,
) => {
  // Checking first avoids needing CREATE on the database once the schema exists.
  await execute(`
    do $$
    begin
      if to_regnamespace('${archiveSchema}') is null then
        create schema ${archiveSchema};
      end if;
    end
    $$
  `);

  for (const table of tables) {
    for (const statement of table.ddl) {
      await execute(statement);
    }
  }
};
