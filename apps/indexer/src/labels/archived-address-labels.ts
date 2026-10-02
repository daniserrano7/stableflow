import pg from "pg";
import { env } from "../env/env.js";
import { archiveTables } from "../storage/schemas.js";
import type {
  AddressCategory,
  AddressConfidence,
  AddressCountingPolicy,
} from "./base-address-labels.js";

const { Pool } = pg;

type Address = `0x${string}`;

export type ArchivedAddressLabel = {
  address: Address;
  archivedAt: bigint;
  attributionGroup: string;
  category: AddressCategory;
  confidence: AddressConfidence;
  countingPolicy: AddressCountingPolicy;
  entityId: string;
  entityName: string;
  firstSeenBlock: bigint;
  id: string;
  logIndex: number;
  poolKind: string | null;
  role: string;
  sourceAddress: Address;
  sourceEvent: string;
  sourceType: string;
  token0: Address | null;
  token1: Address | null;
  transactionHash: Address;
};

type ArchivedAddressLabelDbRow = {
  address: Address;
  archived_at: string;
  attribution_group: string;
  category: AddressCategory;
  confidence: AddressConfidence;
  counting_policy: AddressCountingPolicy;
  entity_id: string;
  entity_name: string;
  first_seen_block: string;
  id: string;
  log_index: number;
  pool_kind: string | null;
  role: string;
  source_address: Address;
  source_event: string;
  source_type: string;
  token0: Address | null;
  token1: Address | null;
  transaction_hash: Address;
};

const undefinedTableErrorCode = "42P01";

let pool: pg.Pool | null = null;

const getPool = () => {
  pool ??= new Pool({
    application_name: "stableflow-indexer-archived-labels",
    connectionString: env.DATABASE_URL,
    max: 1,
  });

  return pool;
};

/**
 * Reads labels archived at or after `archivedAt` (epoch seconds): earlier deployments'
 * discoveries and operator promotions. Returns nothing until the archive exists.
 */
export const readArchivedAddressLabels = async (
  archivedAt: bigint,
): Promise<ArchivedAddressLabel[]> => {
  try {
    const result = await getPool().query<ArchivedAddressLabelDbRow>(
      `
        select
          id,
          address,
          entity_id,
          entity_name,
          category,
          role,
          attribution_group,
          counting_policy,
          confidence,
          source_type,
          source_address,
          source_event,
          token0,
          token1,
          pool_kind,
          first_seen_block::text,
          transaction_hash,
          log_index,
          archived_at::text
        from ${archiveTables.discoveredAddressLabels}
        where archived_at >= $1::bigint
        order by archived_at, id
      `,
      [archivedAt.toString()],
    );

    return result.rows.map((row) => ({
      address: row.address,
      archivedAt: BigInt(row.archived_at),
      attributionGroup: row.attribution_group,
      category: row.category,
      confidence: row.confidence,
      countingPolicy: row.counting_policy,
      entityId: row.entity_id,
      entityName: row.entity_name,
      firstSeenBlock: BigInt(row.first_seen_block),
      id: row.id,
      logIndex: row.log_index,
      poolKind: row.pool_kind,
      role: row.role,
      sourceAddress: row.source_address,
      sourceEvent: row.source_event,
      sourceType: row.source_type,
      token0: row.token0,
      token1: row.token1,
      transactionHash: row.transaction_hash,
    }));
  } catch (error) {
    if ((error as { code?: unknown }).code === undefinedTableErrorCode) {
      return [];
    }

    throw error;
  }
};
