import type { Address } from "viem";
import { baseUsdc } from "../chains/base.chain.js";
import { type AddressCountingPolicy, getBaseAddressLabel } from "../labels/base-address-labels.js";
import type { CandidateVerification, UnidentifiedAddressCandidate } from "./candidates.js";
import type { ReadOnlyDb } from "./db.js";

type CounterpartyVolumeDbRow = {
  counterparty: Address;
  total_value: string;
  transfer_count: string;
};

type DiscoveredCounterpartyLabelDbRow = {
  address: Address;
  attribution_group: string;
  category: string;
  counting_policy: AddressCountingPolicy;
  entity_id: string;
  entity_name: string;
  role: string;
};

type KnownCounterpartyLabel = {
  address: Address;
  attributionGroup: string;
  category: string;
  countingPolicy: AddressCountingPolicy;
  entityId: string;
  entityName: string;
  role: string;
};

const minimumDominantKnownCounterpartyShareBps = 8_000n;
const minimumHighValueKnownCounterpartyShareBps = 4_000n;
const highValueKnownCounterpartyThreshold = 100_000_000n * 10n ** BigInt(baseUsdc.decimals);

const normalizeAddress = (address: Address) => address.toLowerCase() as Address;

const toBigInt = (value: string) => BigInt(value);

const toBasisPoints = (part: bigint, total: bigint) =>
  total === 0n ? 0n : (part * 10_000n) / total;

const formatBasisPoints = (basisPoints: bigint) => {
  const integerPart = basisPoints / 100n;
  const decimalPart = (basisPoints % 100n).toString().padStart(2, "0");

  return `${integerPart.toString()}.${decimalPart}%`;
};

const getDiscoveredCounterpartyLabels = async (
  db: ReadOnlyDb,
  addresses: Address[],
): Promise<Map<string, KnownCounterpartyLabel>> => {
  if (addresses.length === 0) {
    return new Map();
  }

  const rows = await db.query<DiscoveredCounterpartyLabelDbRow>(
    `
      select
        lower(address::text) as address,
        entity_id,
        entity_name,
        category,
        role,
        attribution_group,
        counting_policy
      from discovered_address_labels
      where lower(address::text) = any($1::text[])
    `,
    [addresses.map((address) => address.toLowerCase())],
  );

  return new Map(
    rows.map((row) => [
      row.address.toLowerCase(),
      {
        address: normalizeAddress(row.address),
        attributionGroup: row.attribution_group,
        category: row.category,
        countingPolicy: row.counting_policy,
        entityId: row.entity_id,
        entityName: row.entity_name,
        role: row.role,
      },
    ]),
  );
};

const getKnownCounterpartyLabel = (
  address: Address,
  discoveredLabels: Map<string, KnownCounterpartyLabel>,
): KnownCounterpartyLabel | null => {
  const staticLabel = getBaseAddressLabel(address);

  if (staticLabel !== undefined) {
    return {
      address: staticLabel.address,
      attributionGroup: staticLabel.attributionGroup,
      category: staticLabel.category,
      countingPolicy: staticLabel.countingPolicy,
      entityId: staticLabel.entityId,
      entityName: staticLabel.entityName,
      role: staticLabel.role,
    };
  }

  return discoveredLabels.get(address.toLowerCase()) ?? null;
};

export const verifyKnownCounterpartyPattern = async (
  db: ReadOnlyDb,
  candidate: UnidentifiedAddressCandidate,
): Promise<CandidateVerification | null> => {
  const counterpartyRows = await db.query<CounterpartyVolumeDbRow>(
    `
      with candidate_sides as (
        select
          lower(to_address::text) as counterparty,
          value
        from usdc_transfers
        where lower(from_address::text) = $1::text
          and block_timestamp >= $2::bigint
          and block_timestamp <= $3::bigint
        union all
        select
          lower(from_address::text) as counterparty,
          value
        from usdc_transfers
        where lower(to_address::text) = $1::text
          and block_timestamp >= $2::bigint
          and block_timestamp <= $3::bigint
      )
      select
        counterparty as counterparty,
        count(*)::text as transfer_count,
        sum(value)::text as total_value
      from candidate_sides
      group by counterparty
      order by sum(value) desc
      limit 25
    `,
    [
      candidate.address.toLowerCase(),
      candidate.firstSeenTimestamp.toString(),
      candidate.lastSeenTimestamp.toString(),
    ],
  );

  if (counterpartyRows.length === 0) {
    return null;
  }

  const counterparties = counterpartyRows.map((row) => normalizeAddress(row.counterparty));
  const discoveredLabels = await getDiscoveredCounterpartyLabels(db, counterparties);
  const totalCounterpartyValue = counterpartyRows.reduce(
    (total, row) => total + toBigInt(row.total_value),
    0n,
  );
  const knownCounterparties = counterpartyRows.flatMap((row) => {
    const address = normalizeAddress(row.counterparty);
    const label = getKnownCounterpartyLabel(address, discoveredLabels);

    if (label === null) {
      return [];
    }

    return [
      {
        address,
        label,
        totalValue: toBigInt(row.total_value),
        transferCount: toBigInt(row.transfer_count),
      },
    ];
  });

  if (knownCounterparties.length === 0) {
    return null;
  }

  const entityTotals = new Map<
    string,
    {
      category: string;
      entityId: string;
      entityName: string;
      totalValue: bigint;
      transferCount: bigint;
      topCounterparties: Array<{
        address: Address;
        role: string;
        totalValue: string;
        transferCount: string;
      }>;
    }
  >();

  for (const counterparty of knownCounterparties) {
    const entityTotal = entityTotals.get(counterparty.label.entityId) ?? {
      category: counterparty.label.category,
      entityId: counterparty.label.entityId,
      entityName: counterparty.label.entityName,
      totalValue: 0n,
      transferCount: 0n,
      topCounterparties: [],
    };

    entityTotal.totalValue += counterparty.totalValue;
    entityTotal.transferCount += counterparty.transferCount;
    entityTotal.topCounterparties.push({
      address: counterparty.address,
      role: counterparty.label.role,
      totalValue: counterparty.totalValue.toString(),
      transferCount: counterparty.transferCount.toString(),
    });

    entityTotals.set(counterparty.label.entityId, entityTotal);
  }

  const dominantEntity = [...entityTotals.values()].sort((left, right) =>
    left.totalValue === right.totalValue ? 0 : left.totalValue > right.totalValue ? -1 : 1,
  )[0];

  if (dominantEntity === undefined) {
    return null;
  }

  const knownValue = knownCounterparties.reduce(
    (total, counterparty) => total + counterparty.totalValue,
    0n,
  );
  const dominantShareBps = toBasisPoints(dominantEntity.totalValue, totalCounterpartyValue);
  const knownShareBps = toBasisPoints(knownValue, totalCounterpartyValue);
  const isDominatedByKnownEntity =
    dominantShareBps >= minimumDominantKnownCounterpartyShareBps &&
    knownShareBps >= minimumDominantKnownCounterpartyShareBps;
  const isHighValueKnownEntityInteraction =
    dominantShareBps >= minimumHighValueKnownCounterpartyShareBps &&
    dominantEntity.totalValue >= highValueKnownCounterpartyThreshold;

  if (!isDominatedByKnownEntity && !isHighValueKnownEntityInteraction) {
    return null;
  }

  return {
    attributionGroup: "unidentified",
    confidence: "candidate",
    countingPolicy: "boundary",
    evidenceDetails: JSON.stringify({
      dominantEntityId: dominantEntity.entityId,
      dominantEntityName: dominantEntity.entityName,
      dominantShare: formatBasisPoints(dominantShareBps),
      knownCounterpartyShare: formatBasisPoints(knownShareBps),
      knownCounterpartyValue: knownValue.toString(),
      totalCounterpartyValue: totalCounterpartyValue.toString(),
      topCounterparties: dominantEntity.topCounterparties
        .sort((left, right) =>
          BigInt(left.totalValue) === BigInt(right.totalValue)
            ? 0
            : BigInt(left.totalValue) > BigInt(right.totalValue)
              ? -1
              : 1,
        )
        .slice(0, 10),
    }),
    evidenceSource: "known_counterparty_pattern",
    poolKind: null,
    sourceAddress: candidate.address,
    sourceEvent: "USDC Transfer counterparty pattern",
    suggestedCategory: "unidentified",
    suggestedEntityId: "unidentified",
    suggestedEntityName: `${dominantEntity.entityName}-adjacent actor`,
    suggestedRole: "external_actor",
    token0: null,
    token1: null,
    verifier: "known_protocol_counterparty_pattern",
  };
};
