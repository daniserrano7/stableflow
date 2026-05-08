import type { InspectionArgs } from "./args.js";
import type { ReadOnlyDb } from "./db.js";

const bucketSizeSeconds = 60n;

export type InspectionWindow = {
  endEpochExclusive: bigint;
  latestBlock: bigint;
  latestTimestamp: bigint;
  minutes: number;
  startEpoch: bigint;
  totalIndexedTransfers: bigint;
};

export type TransferMetrics = {
  maxBlock: bigint | null;
  minBlock: bigint | null;
  totalValue: bigint;
  transferCount: bigint;
};

export type VolumeBucketMetrics = {
  rowCount: bigint;
  totalValue: bigint;
  transferCount: bigint;
};

export type EntityFlowRow = {
  category: string;
  direction: string;
  entityId: string;
  entityName: string;
  totalValue: bigint;
  transferCount: bigint;
};

export type EntityFlowMetrics = {
  totalValue: bigint;
  transferCount: bigint;
  unidentifiedValue: bigint;
};

export type EntityPairFlowRow = {
  fromCategory: string;
  fromEntityId: string;
  fromEntityName: string;
  toCategory: string;
  toEntityId: string;
  toEntityName: string;
  totalValue: bigint;
  transferCount: bigint;
};

export type EntityPairFlowMetrics = {
  totalValue: bigint;
  transferCount: bigint;
};

export type BridgeFlowRow = {
  bridgeId: string;
  bridgeName: string;
  direction: string;
  eventCount: bigint;
  remoteChainId: bigint | null;
  remoteDomain: number | null;
  totalValue: bigint;
};

export type LabelSummaryRow = {
  category: string;
  entityId: string;
  entityName: string;
  labelCount: bigint;
  sourceType: string;
};

type LatestTransferRow = {
  latest_block: string | null;
  latest_timestamp: string | null;
  total_indexed_transfers: string;
};

type TransferMetricsRow = {
  max_block: string | null;
  min_block: string | null;
  total_value: string;
  transfer_count: string;
};

type VolumeBucketMetricsRow = {
  row_count: string;
  total_value: string;
  transfer_count: string;
};

type EntityFlowDbRow = {
  category: string;
  direction: string;
  entity_id: string;
  entity_name: string;
  total_value: string;
  transfer_count: string;
};

type EntityFlowMetricsRow = {
  total_value: string;
  transfer_count: string;
  unidentified_value: string;
};

type EntityPairFlowDbRow = {
  from_category: string;
  from_entity_id: string;
  from_entity_name: string;
  to_category: string;
  to_entity_id: string;
  to_entity_name: string;
  total_value: string;
  transfer_count: string;
};

type EntityPairFlowMetricsRow = {
  total_value: string;
  transfer_count: string;
};

type BridgeFlowDbRow = {
  bridge_id: string;
  bridge_name: string;
  direction: string;
  event_count: string;
  remote_chain_id: string | null;
  remote_domain: number | null;
  total_value: string;
};

type LabelSummaryDbRow = {
  category: string;
  entity_id: string;
  entity_name: string;
  label_count: string;
  source_type: string;
};

const toBigInt = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return BigInt(value);
};

const firstRow = <Row>(rows: Row[]) => {
  const row = rows[0];

  if (row === undefined) {
    throw new Error("Expected query to return one row");
  }

  return row;
};

const getWindowParams = (window: InspectionWindow) => [
  window.startEpoch.toString(),
  window.endEpochExclusive.toString(),
];

export const getInspectionWindow = async (
  db: ReadOnlyDb,
  args: InspectionArgs,
): Promise<InspectionWindow | null> => {
  const latestTransfer = firstRow(
    await db.query<LatestTransferRow>(`
      select
        max(block_number)::text as latest_block,
        max(block_timestamp)::text as latest_timestamp,
        count(*)::text as total_indexed_transfers
      from usdc_transfers
    `),
  );

  const latestBlock = toBigInt(latestTransfer.latest_block);
  const latestTimestamp = toBigInt(latestTransfer.latest_timestamp);

  if (latestBlock === null || latestTimestamp === null) {
    return null;
  }

  const endBucket = latestTimestamp - (latestTimestamp % bucketSizeSeconds);
  const startEpoch = endBucket - BigInt(args.minutes - 1) * bucketSizeSeconds;

  return {
    endEpochExclusive: endBucket + bucketSizeSeconds,
    latestBlock,
    latestTimestamp,
    minutes: args.minutes,
    startEpoch,
    totalIndexedTransfers: BigInt(latestTransfer.total_indexed_transfers),
  };
};

export const getRawTransferMetrics = async (db: ReadOnlyDb, window: InspectionWindow) => {
  const row = firstRow(
    await db.query<TransferMetricsRow>(
      `
        select
          count(*)::text as transfer_count,
          coalesce(sum(value), 0)::text as total_value,
          min(block_number)::text as min_block,
          max(block_number)::text as max_block
        from usdc_transfers
        where block_timestamp >= $1::bigint
          and block_timestamp < $2::bigint
      `,
      getWindowParams(window),
    ),
  );

  return {
    maxBlock: toBigInt(row.max_block),
    minBlock: toBigInt(row.min_block),
    totalValue: BigInt(row.total_value),
    transferCount: BigInt(row.transfer_count),
  } satisfies TransferMetrics;
};

export const getVolumeBucketMetrics = async (db: ReadOnlyDb, window: InspectionWindow) => {
  const row = firstRow(
    await db.query<VolumeBucketMetricsRow>(
      `
        select
          count(*)::text as row_count,
          coalesce(sum(transfer_count), 0)::text as transfer_count,
          coalesce(sum(total_value), 0)::text as total_value
        from usdc_transfer_volume_buckets
        where bucket_start >= $1::bigint
          and bucket_start < $2::bigint
      `,
      getWindowParams(window),
    ),
  );

  return {
    rowCount: BigInt(row.row_count),
    totalValue: BigInt(row.total_value),
    transferCount: BigInt(row.transfer_count),
  } satisfies VolumeBucketMetrics;
};

export const getEntityFlows = async (db: ReadOnlyDb, window: InspectionWindow, limit: number) => {
  const rows = await db.query<EntityFlowDbRow>(
    `
      select
        entity_id,
        entity_name,
        category,
        direction,
        sum(transfer_count)::text as transfer_count,
        sum(total_value)::text as total_value
      from usdc_entity_flow_buckets
      where bucket_start >= $1::bigint
        and bucket_start < $2::bigint
      group by entity_id, entity_name, category, direction
      order by sum(total_value) desc
      limit $3::integer
    `,
    [...getWindowParams(window), limit],
  );

  return rows.map(
    (row) =>
      ({
        category: row.category,
        direction: row.direction,
        entityId: row.entity_id,
        entityName: row.entity_name,
        totalValue: BigInt(row.total_value),
        transferCount: BigInt(row.transfer_count),
      }) satisfies EntityFlowRow,
  );
};

export const getEntityFlowMetrics = async (db: ReadOnlyDb, window: InspectionWindow) => {
  const row = firstRow(
    await db.query<EntityFlowMetricsRow>(
      `
        select
          coalesce(sum(transfer_count), 0)::text as transfer_count,
          coalesce(sum(total_value), 0)::text as total_value,
          coalesce(sum(total_value) filter (where entity_id = 'unidentified'), 0)::text as unidentified_value
        from usdc_entity_flow_buckets
        where bucket_start >= $1::bigint
          and bucket_start < $2::bigint
      `,
      getWindowParams(window),
    ),
  );

  return {
    totalValue: BigInt(row.total_value),
    transferCount: BigInt(row.transfer_count),
    unidentifiedValue: BigInt(row.unidentified_value),
  } satisfies EntityFlowMetrics;
};

export const getEntityPairFlows = async (
  db: ReadOnlyDb,
  window: InspectionWindow,
  limit: number,
) => {
  const rows = await db.query<EntityPairFlowDbRow>(
    `
      select
        from_entity_id,
        from_entity_name,
        from_category,
        to_entity_id,
        to_entity_name,
        to_category,
        sum(transfer_count)::text as transfer_count,
        sum(total_value)::text as total_value
      from usdc_entity_pair_flow_buckets
      where bucket_start >= $1::bigint
        and bucket_start < $2::bigint
      group by from_entity_id, from_entity_name, from_category, to_entity_id, to_entity_name, to_category
      order by sum(total_value) desc
      limit $3::integer
    `,
    [...getWindowParams(window), limit],
  );

  return rows.map(
    (row) =>
      ({
        fromCategory: row.from_category,
        fromEntityId: row.from_entity_id,
        fromEntityName: row.from_entity_name,
        toCategory: row.to_category,
        toEntityId: row.to_entity_id,
        toEntityName: row.to_entity_name,
        totalValue: BigInt(row.total_value),
        transferCount: BigInt(row.transfer_count),
      }) satisfies EntityPairFlowRow,
  );
};

export const getEntityPairFlowMetrics = async (db: ReadOnlyDb, window: InspectionWindow) => {
  const row = firstRow(
    await db.query<EntityPairFlowMetricsRow>(
      `
        select
          coalesce(sum(transfer_count), 0)::text as transfer_count,
          coalesce(sum(total_value), 0)::text as total_value
        from usdc_entity_pair_flow_buckets
        where bucket_start >= $1::bigint
          and bucket_start < $2::bigint
      `,
      getWindowParams(window),
    ),
  );

  return {
    totalValue: BigInt(row.total_value),
    transferCount: BigInt(row.transfer_count),
  } satisfies EntityPairFlowMetrics;
};

export const getBridgeFlows = async (db: ReadOnlyDb, window: InspectionWindow, limit: number) => {
  const rows = await db.query<BridgeFlowDbRow>(
    `
      select
        bridge_id,
        bridge_name,
        direction,
        remote_chain_id::text as remote_chain_id,
        remote_domain,
        sum(event_count)::text as event_count,
        sum(total_value)::text as total_value
      from usdc_bridge_flow_buckets
      where bucket_start >= $1::bigint
        and bucket_start < $2::bigint
      group by bridge_id, bridge_name, direction, remote_chain_id, remote_domain
      order by sum(total_value) desc
      limit $3::integer
    `,
    [...getWindowParams(window), limit],
  );

  return rows.map(
    (row) =>
      ({
        bridgeId: row.bridge_id,
        bridgeName: row.bridge_name,
        direction: row.direction,
        eventCount: BigInt(row.event_count),
        remoteChainId: toBigInt(row.remote_chain_id),
        remoteDomain: row.remote_domain,
        totalValue: BigInt(row.total_value),
      }) satisfies BridgeFlowRow,
  );
};

export const getLabelSummaries = async (db: ReadOnlyDb, limit: number) => {
  const rows = await db.query<LabelSummaryDbRow>(
    `
      select
        entity_id,
        entity_name,
        category,
        source_type,
        count(*)::text as label_count
      from discovered_address_labels
      group by entity_id, entity_name, category, source_type
      order by count(*) desc
      limit $1::integer
    `,
    [limit],
  );

  return rows.map(
    (row) =>
      ({
        category: row.category,
        entityId: row.entity_id,
        entityName: row.entity_name,
        labelCount: BigInt(row.label_count),
        sourceType: row.source_type,
      }) satisfies LabelSummaryRow,
  );
};
