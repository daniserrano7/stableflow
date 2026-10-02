import type { Address } from "viem";
import { base } from "viem/chains";
import { archivedLabelsTable, ensureArchiveTables } from "../archive/tables.js";
import { baseUsdc } from "../src/chains/base.chain.js";
import { baseAddressLabels } from "../src/labels/base-address-labels.js";
import { archiveTables, opsSchema, opsTables } from "../src/storage/schemas.js";
import type { InspectionArgs } from "./args.js";
import type { OperatorDb, ReadOnlyDb } from "./db.js";
import { isAutoPromotable } from "./discovery-policy.js";
import { getInspectionWindow, type InspectionWindow } from "./queries.js";

export { isAutoPromotable } from "./discovery-policy.js";

export type CandidateStatus = "candidate" | "rejected" | "verified";

export type UnidentifiedAddressCandidate = {
  address: Address;
  candidateStatus: CandidateStatus | null;
  firstSeenBlock: bigint;
  firstSeenTimestamp: bigint;
  incomingCount: bigint;
  incomingValue: bigint;
  lastSeenBlock: bigint;
  lastSeenTimestamp: bigint;
  outgoingCount: bigint;
  outgoingValue: bigint;
  totalTouchValue: bigint;
  transferCount: bigint;
  uniqueCounterparties: bigint;
};

export type CandidateVerification = {
  attributionGroup: string;
  confidence: "candidate" | "high" | "medium";
  countingPolicy: "boundary" | "discovery_source" | "ignore" | "internal";
  evidenceDetails: string;
  evidenceSource: string;
  poolKind: string | null;
  sourceAddress: Address;
  sourceEvent: string;
  suggestedCategory: string;
  suggestedEntityId: string;
  suggestedEntityName: string;
  suggestedRole: string;
  token0: Address | null;
  token1: Address | null;
  verifier: string;
};

export type AddressLabelCandidate = UnidentifiedAddressCandidate &
  CandidateVerification & {
    promotedAt: bigint | null;
    rejectionReason: string | null;
    reviewedAt: bigint | null;
    status: CandidateStatus;
  };

type CandidateDbRow = {
  address: Address;
  candidate_status: CandidateStatus | null;
  first_seen_block: string;
  first_seen_timestamp: string;
  incoming_count: string;
  incoming_value: string;
  last_seen_block: string;
  last_seen_timestamp: string;
  outgoing_count: string;
  outgoing_value: string;
  total_touch_value: string;
  transfer_count: string;
  unique_counterparties: string;
};

type StoredCandidateDbRow = CandidateDbRow & {
  attribution_group: string;
  confidence: "candidate" | "high" | "medium";
  counting_policy: "boundary" | "discovery_source" | "ignore" | "internal";
  evidence_details: string;
  evidence_source: string;
  pool_kind: string | null;
  promoted_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  source_address: Address;
  source_event: string;
  status: CandidateStatus;
  suggested_category: string;
  suggested_entity_id: string;
  suggested_entity_name: string;
  suggested_role: string;
  token0: Address | null;
  token1: Address | null;
  verifier: string;
};

const staticLabelAddresses = baseAddressLabels.map((label) => label.address.toLowerCase());
const ignoredCandidateAddresses = [
  ...staticLabelAddresses,
  "0x0000000000000000000000000000000000000000",
];

const toBigInt = (value: string) => BigInt(value);

const normalizeAddress = (address: Address) => address.toLowerCase() as Address;

const hasLabelOpsTables = async (db: ReadOnlyDb) => {
  const rows = await db.query<{ exists: boolean }>(`
    select
      to_regclass('${opsTables.addressLabelCandidateReviews}') is not null
      and to_regclass('${archiveTables.discoveredAddressLabels}') is not null as exists
  `);

  return rows[0]?.exists ?? false;
};

export const ensureOpsSchema = async (db: OperatorDb) => {
  // Checking first avoids needing CREATE on the database once the schema exists.
  await db.execute(`
    do $$
    begin
      if to_regnamespace('${opsSchema}') is null then
        create schema ${opsSchema};
      end if;
    end
    $$
  `);
};

export const ensureLabelOpsTables = async (db: OperatorDb) => {
  await ensureOpsSchema(db);

  await db.execute(`
    create table if not exists ${opsTables.addressLabelCandidateReviews} (
      id text primary key,
      chain_id integer not null,
      address text not null,
      status text not null,
      suggested_entity_id text not null,
      suggested_entity_name text not null,
      suggested_category text not null,
      suggested_role text not null,
      attribution_group text not null,
      counting_policy text not null,
      confidence text not null,
      evidence_source text not null,
      evidence_details text not null,
      verifier text not null,
      source_address text not null,
      source_event text not null,
      token0 text,
      token1 text,
      pool_kind text,
      observed_transfer_count numeric not null,
      observed_incoming_count numeric not null,
      observed_outgoing_count numeric not null,
      observed_incoming_value numeric not null,
      observed_outgoing_value numeric not null,
      observed_total_value numeric not null,
      first_seen_block numeric not null,
      last_seen_block numeric not null,
      first_seen_timestamp numeric not null,
      last_seen_timestamp numeric not null,
      reviewed_at numeric,
      checked_at numeric,
      promoted_at numeric,
      rejection_reason text
    )
  `);

  await db.execute(`
    alter table ${opsTables.addressLabelCandidateReviews}
    add column if not exists checked_at numeric
  `);

  await db.execute(`
    create index if not exists address_label_candidate_reviews_address_idx
    on ${opsTables.addressLabelCandidateReviews} (address)
  `);

  await db.execute(`
    create index if not exists address_label_candidate_reviews_status_idx
    on ${opsTables.addressLabelCandidateReviews} (status)
  `);

  await db.execute(`
    create index if not exists address_label_candidate_reviews_observed_total_value_idx
    on ${opsTables.addressLabelCandidateReviews} (observed_total_value)
  `);

  // Promotions land in the archived labels, which every indexer deployment syncs from.
  await ensureArchiveTables((sql) => db.execute(sql), [archivedLabelsTable]);
};

const rowToUnidentifiedCandidate = (row: CandidateDbRow): UnidentifiedAddressCandidate => ({
  address: normalizeAddress(row.address),
  candidateStatus: row.candidate_status,
  firstSeenBlock: toBigInt(row.first_seen_block),
  firstSeenTimestamp: toBigInt(row.first_seen_timestamp),
  incomingCount: toBigInt(row.incoming_count),
  incomingValue: toBigInt(row.incoming_value),
  lastSeenBlock: toBigInt(row.last_seen_block),
  lastSeenTimestamp: toBigInt(row.last_seen_timestamp),
  outgoingCount: toBigInt(row.outgoing_count),
  outgoingValue: toBigInt(row.outgoing_value),
  totalTouchValue: toBigInt(row.total_touch_value),
  transferCount: toBigInt(row.transfer_count),
  uniqueCounterparties: toBigInt(row.unique_counterparties),
});

const rowToStoredCandidate = (row: StoredCandidateDbRow): AddressLabelCandidate => ({
  ...rowToUnidentifiedCandidate(row),
  attributionGroup: row.attribution_group,
  confidence: row.confidence,
  countingPolicy: row.counting_policy,
  evidenceDetails: row.evidence_details,
  evidenceSource: row.evidence_source,
  poolKind: row.pool_kind,
  promotedAt: row.promoted_at === null ? null : toBigInt(row.promoted_at),
  rejectionReason: row.rejection_reason,
  reviewedAt: row.reviewed_at === null ? null : toBigInt(row.reviewed_at),
  sourceAddress: row.source_address,
  sourceEvent: row.source_event,
  status: row.status,
  suggestedCategory: row.suggested_category,
  suggestedEntityId: row.suggested_entity_id,
  suggestedEntityName: row.suggested_entity_name,
  suggestedRole: row.suggested_role,
  token0: row.token0,
  token1: row.token1,
  verifier: row.verifier,
});

export const getUnidentifiedAddressCandidates = async (
  db: ReadOnlyDb,
  args: InspectionArgs,
  options: { checkedCooldownMinutes?: number } = {},
): Promise<{
  candidates: UnidentifiedAddressCandidate[];
  window: InspectionWindow | null;
}> => {
  const window = await getInspectionWindow(db, args);

  if (window === null) {
    return {
      candidates: [],
      window,
    };
  }

  const hasCandidateTable = await hasLabelOpsTables(db);
  const candidateStatusSelect = hasCandidateTable
    ? "candidates.status as candidate_status"
    : "null::text as candidate_status";
  const candidateJoin = hasCandidateTable
    ? `
      left join ${opsTables.addressLabelCandidateReviews} candidates
        on lower(candidates.address::text) = address_volume.address
    `
    : "";
  // Promotions reach the archive before the indexer copies them into its
  // discovered_address_labels, so exclude them here as well.
  const candidateFilter = hasCandidateTable
    ? `
        and coalesce(candidates.status, 'candidate') <> 'rejected'
        and not exists (
          select 1
          from ${archiveTables.discoveredAddressLabels} archived
          where lower(archived.address::text) = address_volume.address
        )
      `
    : "";
  const cooldownThreshold =
    options.checkedCooldownMinutes === undefined
      ? null
      : Math.floor(Date.now() / 1000) - options.checkedCooldownMinutes * 60;
  const checkedCooldownFilter =
    hasCandidateTable && cooldownThreshold !== null
      ? "and (candidates.checked_at is null or candidates.checked_at < $5::bigint)"
      : "";

  const rows = await db.query<CandidateDbRow>(
    `
      with windowed as (
        select
          block_number,
          block_timestamp,
          from_address,
          to_address,
          value
        from usdc_transfers
        where block_timestamp >= $1::bigint
          and block_timestamp < $2::bigint
      ),
      address_sides as (
        select
          from_address as address,
          to_address as counterparty,
          1::bigint as outgoing_count,
          0::bigint as incoming_count,
          value as outgoing_value,
          0::numeric as incoming_value,
          block_number,
          block_timestamp
        from windowed
        union all
        select
          to_address as address,
          from_address as counterparty,
          0::bigint as outgoing_count,
          1::bigint as incoming_count,
          0::numeric as outgoing_value,
          value as incoming_value,
          block_number,
          block_timestamp
        from windowed
      ),
      address_volume as (
        select
          lower(address::text) as address,
          count(distinct lower(counterparty::text))::text as unique_counterparties,
          sum(outgoing_count)::text as outgoing_count,
          sum(incoming_count)::text as incoming_count,
          (sum(outgoing_count) + sum(incoming_count))::text as transfer_count,
          sum(outgoing_value)::text as outgoing_value,
          sum(incoming_value)::text as incoming_value,
          (sum(outgoing_value) + sum(incoming_value))::text as total_touch_value,
          min(block_number)::text as first_seen_block,
          max(block_number)::text as last_seen_block,
          min(block_timestamp)::text as first_seen_timestamp,
          max(block_timestamp)::text as last_seen_timestamp
        from address_sides
        group by lower(address::text)
      )
      select
        address_volume.*,
        ${candidateStatusSelect}
      from address_volume
      left join discovered_address_labels discovered
        on lower(discovered.address::text) = address_volume.address
      ${candidateJoin}
      where discovered.address is null
        and address_volume.address <> all($3::text[])
        ${candidateFilter}
        ${checkedCooldownFilter}
      order by (address_volume.total_touch_value::numeric) desc
      limit $4::integer
    `,
    [
      window.startEpoch.toString(),
      window.endEpochExclusive.toString(),
      ignoredCandidateAddresses,
      args.limit,
      ...(checkedCooldownFilter === "" ? [] : [cooldownThreshold]),
    ],
  );

  return {
    candidates: rows.map(rowToUnidentifiedCandidate),
    window,
  };
};

export const upsertAddressLabelCandidate = async ({
  candidate,
  db,
  verification,
}: {
  candidate: UnidentifiedAddressCandidate;
  db: OperatorDb;
  verification: CandidateVerification;
}) => {
  const status: CandidateStatus = isAutoPromotable(verification) ? "verified" : "candidate";
  const now = BigInt(Math.floor(Date.now() / 1000));

  await ensureLabelOpsTables(db);

  await db.execute(
    `
      insert into ${opsTables.addressLabelCandidateReviews} (
        id,
        chain_id,
        address,
        status,
        suggested_entity_id,
        suggested_entity_name,
        suggested_category,
        suggested_role,
        attribution_group,
        counting_policy,
        confidence,
        evidence_source,
        evidence_details,
        verifier,
        source_address,
        source_event,
        token0,
        token1,
        pool_kind,
        observed_transfer_count,
        observed_incoming_count,
        observed_outgoing_count,
        observed_incoming_value,
        observed_outgoing_value,
        observed_total_value,
        first_seen_block,
        last_seen_block,
        first_seen_timestamp,
        last_seen_timestamp,
        reviewed_at,
        checked_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24,
        $25,
        $26,
        $27,
        $28,
        $29,
        $30,
        $31
      )
      on conflict (id) do update set
        status = excluded.status,
        suggested_entity_id = excluded.suggested_entity_id,
        suggested_entity_name = excluded.suggested_entity_name,
        suggested_category = excluded.suggested_category,
        suggested_role = excluded.suggested_role,
        attribution_group = excluded.attribution_group,
        counting_policy = excluded.counting_policy,
        confidence = excluded.confidence,
        evidence_source = excluded.evidence_source,
        evidence_details = excluded.evidence_details,
        verifier = excluded.verifier,
        source_address = excluded.source_address,
        source_event = excluded.source_event,
        token0 = excluded.token0,
        token1 = excluded.token1,
        pool_kind = excluded.pool_kind,
        observed_transfer_count = excluded.observed_transfer_count,
        observed_incoming_count = excluded.observed_incoming_count,
        observed_outgoing_count = excluded.observed_outgoing_count,
        observed_incoming_value = excluded.observed_incoming_value,
        observed_outgoing_value = excluded.observed_outgoing_value,
        observed_total_value = excluded.observed_total_value,
        first_seen_block = least(address_label_candidate_reviews.first_seen_block, excluded.first_seen_block),
        last_seen_block = greatest(address_label_candidate_reviews.last_seen_block, excluded.last_seen_block),
        first_seen_timestamp = least(address_label_candidate_reviews.first_seen_timestamp, excluded.first_seen_timestamp),
        last_seen_timestamp = greatest(address_label_candidate_reviews.last_seen_timestamp, excluded.last_seen_timestamp),
        reviewed_at = excluded.reviewed_at,
        checked_at = excluded.checked_at,
        rejection_reason = null
      where address_label_candidate_reviews.status <> 'rejected'
    `,
    [
      `${base.id}:${candidate.address}`,
      base.id,
      candidate.address,
      status,
      verification.suggestedEntityId,
      verification.suggestedEntityName,
      verification.suggestedCategory,
      verification.suggestedRole,
      verification.attributionGroup,
      verification.countingPolicy,
      verification.confidence,
      verification.evidenceSource,
      verification.evidenceDetails,
      verification.verifier,
      verification.sourceAddress,
      verification.sourceEvent,
      verification.token0,
      verification.token1,
      verification.poolKind,
      candidate.transferCount.toString(),
      candidate.incomingCount.toString(),
      candidate.outgoingCount.toString(),
      candidate.incomingValue.toString(),
      candidate.outgoingValue.toString(),
      candidate.totalTouchValue.toString(),
      candidate.firstSeenBlock.toString(),
      candidate.lastSeenBlock.toString(),
      candidate.firstSeenTimestamp.toString(),
      candidate.lastSeenTimestamp.toString(),
      isAutoPromotable(verification) ? now.toString() : null,
      now.toString(),
    ],
  );
};

export const getVerifiedMissingLabels = async (
  db: ReadOnlyDb,
  limit: number,
  evidenceSource = "onchain_factory_membership",
) => {
  const hasCandidateTable = await hasLabelOpsTables(db);

  if (!hasCandidateTable) {
    return [];
  }

  const rows = await db.query<StoredCandidateDbRow>(
    `
      select
        address,
        status,
        status as candidate_status,
        suggested_entity_id,
        suggested_entity_name,
        suggested_category,
        suggested_role,
        attribution_group,
        counting_policy,
        confidence,
        evidence_source,
        evidence_details,
        verifier,
        source_address,
        source_event,
        token0,
        token1,
        pool_kind,
        observed_transfer_count::text as transfer_count,
        observed_incoming_count::text as incoming_count,
        observed_outgoing_count::text as outgoing_count,
        observed_incoming_value::text as incoming_value,
        observed_outgoing_value::text as outgoing_value,
        observed_total_value::text as total_touch_value,
        first_seen_block::text,
        last_seen_block::text,
        first_seen_timestamp::text,
        last_seen_timestamp::text,
        reviewed_at::text,
        promoted_at::text,
        rejection_reason,
        '0'::text as unique_counterparties
      from ${opsTables.addressLabelCandidateReviews} reviews
      where status = 'verified'
        and confidence = 'high'
        and evidence_source = $2
        and counting_policy = 'boundary'
        and suggested_entity_id <> 'unidentified'
        and not exists (
          select 1
          from ${archiveTables.discoveredAddressLabels} archived
          where archived.id = reviews.id
        )
      order by observed_total_value desc
      limit $1::integer
    `,
    [limit, evidenceSource],
  );

  return rows.map(rowToStoredCandidate);
};

export const promoteVerifiedCandidates = async (db: OperatorDb, limit: number) => {
  await ensureLabelOpsTables(db);

  const candidates = await getVerifiedMissingLabels(db, limit);
  const now = BigInt(Math.floor(Date.now() / 1000));

  for (const candidate of candidates) {
    await db.execute(
      `
        with promoted as (
          insert into ${archiveTables.discoveredAddressLabels} (
            id,
            chain_id,
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
            first_seen_block,
            source_type,
            transaction_hash,
            log_index
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            'candidate_review',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            0
          )
          on conflict (id) do nothing
        )
        update ${opsTables.addressLabelCandidateReviews}
        set promoted_at = $17::bigint
        where id = $1
      `,
      [
        `${base.id}:${candidate.address}`,
        base.id,
        candidate.address,
        candidate.suggestedEntityId,
        candidate.suggestedEntityName,
        candidate.suggestedCategory,
        candidate.suggestedRole,
        candidate.attributionGroup,
        candidate.countingPolicy,
        candidate.confidence,
        candidate.sourceAddress,
        candidate.sourceEvent,
        candidate.token0,
        candidate.token1,
        candidate.poolKind,
        candidate.firstSeenBlock.toString(),
        now.toString(),
      ],
    );
  }

  return candidates;
};

export const rejectAddressLabelCandidate = async ({
  address,
  db,
  reason,
}: {
  address: Address;
  db: OperatorDb;
  reason: string;
}) => {
  const normalizedAddress = normalizeAddress(address);
  const now = BigInt(Math.floor(Date.now() / 1000));

  await ensureLabelOpsTables(db);

  const rows = await db.execute<{ address: Address }>(
    `
      update ${opsTables.addressLabelCandidateReviews}
      set
        status = 'rejected',
        rejection_reason = $3,
        reviewed_at = $4::bigint
      where id = $1
        and address = $2
        and promoted_at is null
      returning address
    `,
    [`${base.id}:${normalizedAddress}`, normalizedAddress, reason, now.toString()],
  );

  return rows[0] ?? null;
};

export const getFallbackCandidateVerification = (
  candidate: UnidentifiedAddressCandidate,
): CandidateVerification => ({
  attributionGroup: "unidentified",
  confidence: "candidate",
  countingPolicy: "boundary",
  evidenceDetails: JSON.stringify({
    incomingCount: candidate.incomingCount.toString(),
    incomingValue: candidate.incomingValue.toString(),
    outgoingCount: candidate.outgoingCount.toString(),
    outgoingValue: candidate.outgoingValue.toString(),
    totalTouchValue: candidate.totalTouchValue.toString(),
    transferCount: candidate.transferCount.toString(),
    uniqueCounterparties: candidate.uniqueCounterparties.toString(),
  }),
  evidenceSource: "raw_usdc_transfer_pattern",
  poolKind: null,
  sourceAddress: baseUsdc.address,
  sourceEvent: "top_unidentified_usdc_counterparty",
  suggestedCategory: "unidentified",
  suggestedEntityId: "unidentified",
  suggestedEntityName: "Unidentified",
  suggestedRole: "candidate",
  token0: null,
  token1: null,
  verifier: "traffic_pattern",
});
