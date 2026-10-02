import pg from "pg";
import { env } from "../env/env.js";
import { opsTables } from "../ops/schema.js";
import type {
  AddressCategory,
  AddressConfidence,
  AddressCountingPolicy,
} from "./base-address-labels.js";

const { Pool } = pg;

type Address = `0x${string}`;

export type PromotedAddressLabel = {
  address: Address;
  attributionGroup: string;
  category: AddressCategory;
  confidence: AddressConfidence;
  countingPolicy: AddressCountingPolicy;
  entityId: string;
  entityName: string;
  firstSeenBlock: bigint;
  id: string;
  poolKind: string | null;
  promotedAt: bigint;
  role: string;
  sourceAddress: Address;
  sourceEvent: string;
  token0: Address | null;
  token1: Address | null;
};

type PromotedAddressLabelDbRow = {
  address: Address;
  attribution_group: string;
  category: AddressCategory;
  confidence: AddressConfidence;
  counting_policy: AddressCountingPolicy;
  entity_id: string;
  entity_name: string;
  first_seen_block: string;
  id: string;
  pool_kind: string | null;
  promoted_at: string;
  role: string;
  source_address: Address;
  source_event: string;
  token0: Address | null;
  token1: Address | null;
};

const undefinedTableErrorCode = "42P01";

let pool: pg.Pool | null = null;

const getPool = () => {
  pool ??= new Pool({
    application_name: "stableflow-indexer-promoted-labels",
    connectionString: env.DATABASE_URL,
    max: 1,
  });

  return pool;
};

/**
 * Reads operator promotions made at or after `promotedAt` (epoch seconds).
 * Returns nothing until the label worker has created the ops tables.
 */
export const readPromotedAddressLabels = async (
  promotedAt: bigint,
): Promise<PromotedAddressLabel[]> => {
  try {
    const result = await getPool().query<PromotedAddressLabelDbRow>(
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
          source_address,
          source_event,
          token0,
          token1,
          pool_kind,
          first_seen_block::text,
          promoted_at::text
        from ${opsTables.promotedAddressLabels}
        where promoted_at >= $1::bigint
        order by promoted_at, id
      `,
      [promotedAt.toString()],
    );

    return result.rows.map((row) => ({
      address: row.address,
      attributionGroup: row.attribution_group,
      category: row.category,
      confidence: row.confidence,
      countingPolicy: row.counting_policy,
      entityId: row.entity_id,
      entityName: row.entity_name,
      firstSeenBlock: BigInt(row.first_seen_block),
      id: row.id,
      poolKind: row.pool_kind,
      promotedAt: BigInt(row.promoted_at),
      role: row.role,
      sourceAddress: row.source_address,
      sourceEvent: row.source_event,
      token0: row.token0,
      token1: row.token1,
    }));
  } catch (error) {
    if ((error as { code?: unknown }).code === undefinedTableErrorCode) {
      return [];
    }

    throw error;
  }
};
