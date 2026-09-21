import { Injectable, NotFoundException } from "@nestjs/common";
import {
  baseAddressLabels,
  type AddressLabel as StaticAddressLabel,
} from "@stableflow/indexer/base-address-labels";
import {
  discoveredAddressLabels,
  usdcEntityFlowBuckets,
  usdcEntityPairFlowBuckets,
  usdcTransfers,
} from "@stableflow/indexer/ponder-schema";
import type {
  EntityAddressLabel,
  EntityCategorySummary,
  EntityCounterpartyFlow,
  EntityDetailResponse,
  EntityDetailSummary,
  EntityDetailWindow,
  EntityFlowSummary,
  EntityListResponse,
  EntitySummary,
  LiveTransferParty,
  LiveTransferRow,
} from "@stableflow/shared";
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { toTokenAmount } from "../tokens/base-usdc.js";

const defaultCounterpartyLimit = 6;
const defaultRecentTransfersLimit = 6;
const defaultWindowMinutes = 60;
const maxCounterpartyCandidateRows = 240;
const maxWindowMinutes = 24 * 60;
const minWindowMinutes = 1;
const oneMinuteBucketSize = "1m";

interface EntityDetailOptions {
  windowMinutes?: number;
}

type EntityRegistryLabel = Pick<
  EntityAddressLabel,
  | "address"
  | "attributionGroup"
  | "category"
  | "countingPolicy"
  | "entityId"
  | "entityName"
  | "firstSeenBlock"
  | "role"
  | "sourceType"
>;

interface DiscoveredAddressLabelRow {
  address: string;
  attributionGroup: string;
  category: string;
  confidence: string;
  countingPolicy: string;
  entityId: string;
  entityName: string;
  firstSeenBlock: string;
  label: string | null;
  logIndex: number;
  poolKind: string | null;
  role: string;
  sourceAddress: string;
  sourceEvent: string;
  sourceType: string;
  token0: string | null;
  token1: string | null;
  transactionHash: string;
}

interface EntityIdentity {
  category: string;
  entityId: string;
  entityName: string;
}

interface EntityFlowAggregateRow {
  inflowTransferCount: string;
  inflowValue: string;
  outflowTransferCount: string;
  outflowValue: string;
}

interface EntityPairFlowAggregateRow {
  fromCategory: string;
  fromEntityId: string;
  fromEntityName: string;
  toCategory: string;
  toEntityId: string;
  toEntityName: string;
  totalValue: string;
  transferCount: string;
}

interface CounterpartyDraft {
  category: string;
  entityId: string;
  entityName: string;
  inflow: bigint;
  outflow: bigint;
  transferCount: bigint;
}

interface TransferRecord {
  blockNumber: bigint;
  blockTimestamp: bigint;
  fromAddress: string;
  id: string;
  logIndex: number;
  toAddress: string;
  transactionHash: string;
  value: bigint;
}

interface AddressLabelLookup {
  address: string;
  category: string;
  entityId: string;
  entityName: string;
}

interface BucketWindow {
  bucketEndSeconds: number;
  bucketStartSeconds: number;
  minutes: number;
}

@Injectable()
export class EntitiesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listEntities(): Promise<EntityListResponse> {
    const [discoveredLabels, flowIdentities] = await Promise.all([
      this.databaseService.db
        .select({
          address: discoveredAddressLabels.address,
          attributionGroup: discoveredAddressLabels.attributionGroup,
          category: discoveredAddressLabels.category,
          countingPolicy: discoveredAddressLabels.countingPolicy,
          entityId: discoveredAddressLabels.entityId,
          entityName: discoveredAddressLabels.entityName,
          firstSeenBlock: sql<string>`${discoveredAddressLabels.firstSeenBlock}::text`,
          role: discoveredAddressLabels.role,
          sourceType: discoveredAddressLabels.sourceType,
        })
        .from(discoveredAddressLabels)
        .orderBy(asc(discoveredAddressLabels.firstSeenBlock), asc(discoveredAddressLabels.id)),
      this.databaseService.db
        .selectDistinctOn([usdcEntityFlowBuckets.entityId], {
          category: usdcEntityFlowBuckets.category,
          entityId: usdcEntityFlowBuckets.entityId,
          entityName: usdcEntityFlowBuckets.entityName,
        })
        .from(usdcEntityFlowBuckets)
        .orderBy(asc(usdcEntityFlowBuckets.entityId), desc(usdcEntityFlowBuckets.bucketStart)),
    ]);
    const labelsByEntity = new Map<string, Map<string, EntityRegistryLabel>>();

    // Match detail pages: discovered labels replace static labels at the same address.
    for (const label of [
      ...baseAddressLabels.map(toStaticEntityAddressLabel),
      ...discoveredLabels,
    ]) {
      const labels = labelsByEntity.get(label.entityId) ?? new Map<string, EntityRegistryLabel>();
      labels.set(label.address.toLowerCase(), label);
      labelsByEntity.set(label.entityId, labels);
    }

    const identitiesByEntity = new Map(
      flowIdentities.map((identity) => [identity.entityId, identity]),
    );
    const entityIds = new Set([...labelsByEntity.keys(), ...identitiesByEntity.keys()]);
    const entities: EntitySummary[] = [];

    for (const entityId of entityIds) {
      const labels = [...(labelsByEntity.get(entityId)?.values() ?? [])].sort(
        compareEntityAddressLabels,
      );
      const summary = this.toEntityDetailSummary(
        entityId,
        labels,
        identitiesByEntity.get(entityId) ?? null,
      );

      if (summary !== null) {
        const { attributionGroups: _, ...entity } = summary;
        entities.push(entity);
      }
    }

    entities.sort(
      (a, b) =>
        b.labelCount - a.labelCount ||
        a.entityName.localeCompare(b.entityName) ||
        a.entityId.localeCompare(b.entityId),
    );

    return {
      data: entities,
      meta: {
        categories: this.summarizeCategories(entities),
        generatedAt: new Date().toISOString(),
        totalEntities: entities.length,
        totalLabels: entities.reduce((total, entity) => total + entity.labelCount, 0),
      },
    };
  }

  async getEntityDetail(
    entityId: string,
    options: EntityDetailOptions = {},
  ): Promise<EntityDetailResponse> {
    const normalizedEntityId = entityId.trim();

    if (normalizedEntityId.length === 0) {
      throw new NotFoundException("Entity not found");
    }

    const windowMinutes = normalizeWindowMinutes(options.windowMinutes);
    const [addressLabels, flowIdentity, latestBucketStartSeconds] = await Promise.all([
      this.listEntityAddressLabels(normalizedEntityId),
      this.getEntityIdentityFromFlowBuckets(normalizedEntityId),
      this.getLatestBucketStartSeconds(),
    ]);
    const entity = this.toEntityDetailSummary(normalizedEntityId, addressLabels, flowIdentity);

    if (entity === null) {
      throw new NotFoundException(`Entity "${normalizedEntityId}" not found`);
    }

    const window = getBucketWindow(windowMinutes, latestBucketStartSeconds);
    const [flow, counterparties, recentTransfers] = await Promise.all([
      this.getEntityFlowSummary(normalizedEntityId, window),
      this.listCounterpartyFlows(normalizedEntityId, window, defaultCounterpartyLimit),
      this.listRecentEntityTransfers(addressLabels, defaultRecentTransfersLimit),
    ]);
    const responseWindow = toEntityDetailWindow(window);

    return {
      data: {
        addressLabels,
        counterparties,
        entity,
        flow,
        recentTransfers,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        limits: {
          counterparties: defaultCounterpartyLimit,
          recentTransfers: defaultRecentTransfersLimit,
        },
        window: responseWindow,
      },
    };
  }

  private async listEntityAddressLabels(entityId: string): Promise<EntityAddressLabel[]> {
    const staticLabels = baseAddressLabels
      .filter((label) => label.entityId === entityId)
      .map(toStaticEntityAddressLabel);
    const discoveredLabels = await this.listDiscoveredEntityAddressLabels(entityId);
    const labelsByAddress = new Map<string, EntityAddressLabel>();

    for (const label of staticLabels) {
      labelsByAddress.set(label.address.toLowerCase(), label);
    }

    for (const label of discoveredLabels) {
      labelsByAddress.set(label.address.toLowerCase(), label);
    }

    return [...labelsByAddress.values()].sort(compareEntityAddressLabels);
  }

  private async listDiscoveredEntityAddressLabels(entityId: string): Promise<EntityAddressLabel[]> {
    const rows = await this.databaseService.db
      .select({
        address: discoveredAddressLabels.address,
        attributionGroup: discoveredAddressLabels.attributionGroup,
        category: discoveredAddressLabels.category,
        confidence: discoveredAddressLabels.confidence,
        countingPolicy: discoveredAddressLabels.countingPolicy,
        entityId: discoveredAddressLabels.entityId,
        entityName: discoveredAddressLabels.entityName,
        firstSeenBlock: sql<string>`${discoveredAddressLabels.firstSeenBlock}::text`,
        label: sql<string | null>`null`,
        logIndex: discoveredAddressLabels.logIndex,
        poolKind: discoveredAddressLabels.poolKind,
        role: discoveredAddressLabels.role,
        sourceAddress: discoveredAddressLabels.sourceAddress,
        sourceEvent: discoveredAddressLabels.sourceEvent,
        sourceType: discoveredAddressLabels.sourceType,
        token0: discoveredAddressLabels.token0,
        token1: discoveredAddressLabels.token1,
        transactionHash: discoveredAddressLabels.transactionHash,
      })
      .from(discoveredAddressLabels)
      .where(eq(discoveredAddressLabels.entityId, entityId))
      .orderBy(asc(discoveredAddressLabels.role), asc(discoveredAddressLabels.address));

    return rows.map(toDiscoveredEntityAddressLabel);
  }

  private toEntityDetailSummary(
    entityId: string,
    labels: EntityRegistryLabel[],
    flowIdentity: EntityIdentity | null,
  ): EntityDetailSummary | null {
    const labelIdentity = labels.at(0);
    const staticIdentity = getStaticEntityIdentity(entityId);
    const identity = labelIdentity
      ? {
          category: labelIdentity.category,
          entityId,
          entityName: labelIdentity.entityName,
        }
      : (staticIdentity ?? flowIdentity);

    if (identity === null) {
      return null;
    }

    const seenBlocks = labels.flatMap((label) =>
      label.firstSeenBlock === null ? [] : [label.firstSeenBlock],
    );

    return {
      addressCount: new Set(labels.map((label) => label.address.toLowerCase())).size,
      attributionGroups: uniqueSorted(labels.map((label) => label.attributionGroup)),
      category: identity.category,
      entityId,
      entityName: identity.entityName,
      firstSeenBlock: minBlock(seenBlocks),
      labelCount: labels.length,
      latestSeenBlock: maxBlock(seenBlocks),
      roles: uniqueSorted(labels.map((label) => label.role)),
      sourceTypes: uniqueSorted(labels.map((label) => label.sourceType)),
    };
  }

  private async getEntityIdentityFromFlowBuckets(entityId: string): Promise<EntityIdentity | null> {
    const rows = await this.databaseService.db
      .select({
        category: usdcEntityFlowBuckets.category,
        entityId: usdcEntityFlowBuckets.entityId,
        entityName: usdcEntityFlowBuckets.entityName,
      })
      .from(usdcEntityFlowBuckets)
      .where(eq(usdcEntityFlowBuckets.entityId, entityId))
      .orderBy(desc(usdcEntityFlowBuckets.bucketStart))
      .limit(1);

    return rows.at(0) ?? null;
  }

  private async getLatestBucketStartSeconds() {
    const latestBuckets = await this.databaseService.db
      .select({
        bucketStart: sql<string | null>`max(${usdcEntityFlowBuckets.bucketStart})::text`,
      })
      .from(usdcEntityFlowBuckets)
      .where(eq(usdcEntityFlowBuckets.bucketSize, oneMinuteBucketSize));

    const bucketStart = latestBuckets.at(0)?.bucketStart;

    if (bucketStart === undefined || bucketStart === null) {
      return null;
    }

    return Number(BigInt(bucketStart));
  }

  private async getEntityFlowSummary(
    entityId: string,
    window: BucketWindow,
  ): Promise<EntityFlowSummary> {
    const rows = await this.databaseService.db
      .select({
        inflowTransferCount: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.transferCount}) filter (where ${usdcEntityFlowBuckets.direction} = 'in'), 0)::text`,
        inflowValue: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.totalValue}) filter (where ${usdcEntityFlowBuckets.direction} = 'in'), 0)::text`,
        outflowTransferCount: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.transferCount}) filter (where ${usdcEntityFlowBuckets.direction} = 'out'), 0)::text`,
        outflowValue: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.totalValue}) filter (where ${usdcEntityFlowBuckets.direction} = 'out'), 0)::text`,
      })
      .from(usdcEntityFlowBuckets)
      .where(
        and(
          eq(usdcEntityFlowBuckets.bucketSize, oneMinuteBucketSize),
          eq(usdcEntityFlowBuckets.entityId, entityId),
          gte(usdcEntityFlowBuckets.bucketStart, BigInt(window.bucketStartSeconds)),
          lt(usdcEntityFlowBuckets.bucketStart, BigInt(window.bucketEndSeconds)),
        ),
      );
    const row: EntityFlowAggregateRow = rows.at(0) ?? {
      inflowTransferCount: "0",
      inflowValue: "0",
      outflowTransferCount: "0",
      outflowValue: "0",
    };
    const inflow = BigInt(row.inflowValue);
    const outflow = BigInt(row.outflowValue);
    const inflowTransferCount = BigInt(row.inflowTransferCount);
    const outflowTransferCount = BigInt(row.outflowTransferCount);

    return {
      inflow: toTokenAmount(inflow),
      inflowTransferCount: Number(inflowTransferCount),
      net: toTokenAmount(inflow - outflow),
      outflow: toTokenAmount(outflow),
      outflowTransferCount: Number(outflowTransferCount),
      transferCount: Number(inflowTransferCount + outflowTransferCount),
      window: toEntityDetailWindow(window),
    };
  }

  private async listCounterpartyFlows(
    entityId: string,
    window: BucketWindow,
    limit: number,
  ): Promise<EntityCounterpartyFlow[]> {
    const rows = await this.databaseService.db
      .select({
        fromCategory: usdcEntityPairFlowBuckets.fromCategory,
        fromEntityId: usdcEntityPairFlowBuckets.fromEntityId,
        fromEntityName: usdcEntityPairFlowBuckets.fromEntityName,
        toCategory: usdcEntityPairFlowBuckets.toCategory,
        toEntityId: usdcEntityPairFlowBuckets.toEntityId,
        toEntityName: usdcEntityPairFlowBuckets.toEntityName,
        totalValue: sql<string>`sum(${usdcEntityPairFlowBuckets.totalValue})::text`,
        transferCount: sql<string>`sum(${usdcEntityPairFlowBuckets.transferCount})::text`,
      })
      .from(usdcEntityPairFlowBuckets)
      .where(
        and(
          eq(usdcEntityPairFlowBuckets.bucketSize, oneMinuteBucketSize),
          or(
            eq(usdcEntityPairFlowBuckets.fromEntityId, entityId),
            eq(usdcEntityPairFlowBuckets.toEntityId, entityId),
          ),
          gte(usdcEntityPairFlowBuckets.bucketStart, BigInt(window.bucketStartSeconds)),
          lt(usdcEntityPairFlowBuckets.bucketStart, BigInt(window.bucketEndSeconds)),
        ),
      )
      .groupBy(
        usdcEntityPairFlowBuckets.fromEntityId,
        usdcEntityPairFlowBuckets.fromEntityName,
        usdcEntityPairFlowBuckets.fromCategory,
        usdcEntityPairFlowBuckets.toEntityId,
        usdcEntityPairFlowBuckets.toEntityName,
        usdcEntityPairFlowBuckets.toCategory,
      )
      .orderBy(desc(sql`sum(${usdcEntityPairFlowBuckets.totalValue})`))
      .limit(maxCounterpartyCandidateRows);
    const drafts = reduceCounterpartyRows(entityId, rows);
    const ranked = drafts
      .filter((draft) => draft.inflow !== draft.outflow)
      .sort((a, b) => compareBigIntDesc(abs(toCounterpartyNet(a)), abs(toCounterpartyNet(b))))
      .slice(0, limit);
    const topCounterparty = ranked.at(0);
    const topMagnitude =
      topCounterparty === undefined ? 0n : abs(toCounterpartyNet(topCounterparty));

    return ranked.map((draft, index) => {
      const net = toCounterpartyNet(draft);

      return {
        category: draft.category,
        entityId: draft.entityId,
        entityName: draft.entityName,
        inflow: toTokenAmount(draft.inflow),
        net: toTokenAmount(net),
        outflow: toTokenAmount(draft.outflow),
        rank: index + 1,
        relativeShare: topMagnitude === 0n ? 0 : Number((abs(net) * 10_000n) / topMagnitude) / 100,
        transferCount: Number(draft.transferCount),
      };
    });
  }

  private async listRecentEntityTransfers(
    labels: EntityAddressLabel[],
    limit: number,
  ): Promise<LiveTransferRow[]> {
    const boundaryAddresses = uniqueSorted(
      labels.filter((label) => label.countingPolicy === "boundary").map((label) => label.address),
    );

    if (boundaryAddresses.length === 0) {
      return [];
    }

    const records = await this.databaseService.db
      .select({
        blockNumber: usdcTransfers.blockNumber,
        blockTimestamp: usdcTransfers.blockTimestamp,
        fromAddress: usdcTransfers.fromAddress,
        id: usdcTransfers.id,
        logIndex: usdcTransfers.logIndex,
        toAddress: usdcTransfers.toAddress,
        transactionHash: usdcTransfers.transactionHash,
        value: usdcTransfers.value,
      })
      .from(usdcTransfers)
      .where(
        or(
          inArray(usdcTransfers.fromAddress, boundaryAddresses as `0x${string}`[]),
          inArray(usdcTransfers.toAddress, boundaryAddresses as `0x${string}`[]),
        ),
      )
      .orderBy(desc(usdcTransfers.blockNumber), desc(usdcTransfers.logIndex))
      .limit(limit);

    return this.toLiveTransferRows(records);
  }

  private async toLiveTransferRows(records: TransferRecord[]): Promise<LiveTransferRow[]> {
    const labels = await this.getLabelsForTransferRecords(records);

    return records.map((record) => {
      const from = this.toTransferParty(record.fromAddress, labels);
      const to = this.toTransferParty(record.toAddress, labels);

      return {
        amount: toTokenAmount(record.value),
        blockNumber: record.blockNumber.toString(),
        blockTimestamp: new Date(Number(record.blockTimestamp) * 1000).toISOString(),
        cursor: {
          blockNumber: record.blockNumber.toString(),
          logIndex: record.logIndex,
        },
        entityType: getEntityType([from, to]),
        from,
        id: record.id,
        logIndex: record.logIndex,
        to,
        transactionHash: record.transactionHash,
      };
    });
  }

  private async getLabelsForTransferRecords(
    records: TransferRecord[],
  ): Promise<Map<string, AddressLabelLookup>> {
    const labelsByAddress = new Map<string, AddressLabelLookup>();

    for (const label of baseAddressLabels) {
      labelsByAddress.set(label.address.toLowerCase(), label);
    }

    const missingAddresses = [
      ...new Set(
        records
          .flatMap((record) => [record.fromAddress, record.toAddress])
          .map((address) => address.toLowerCase())
          .filter((address) => !labelsByAddress.has(address)),
      ),
    ];

    if (missingAddresses.length === 0) {
      return labelsByAddress;
    }

    const discoveredLabels = await this.databaseService.db
      .select({
        address: discoveredAddressLabels.address,
        category: discoveredAddressLabels.category,
        entityId: discoveredAddressLabels.entityId,
        entityName: discoveredAddressLabels.entityName,
      })
      .from(discoveredAddressLabels)
      .where(inArray(discoveredAddressLabels.address, missingAddresses as `0x${string}`[]));

    for (const label of discoveredLabels) {
      labelsByAddress.set(label.address.toLowerCase(), label);
    }

    return labelsByAddress;
  }

  private toTransferParty(
    address: string,
    labels: Map<string, AddressLabelLookup>,
  ): LiveTransferParty {
    const label = labels.get(address.toLowerCase());

    if (label === undefined) {
      return {
        address,
        category: "unidentified",
        displayName: cropAddress(address),
        entityId: null,
        entityName: null,
        isIdentified: false,
      };
    }

    return {
      address,
      category: label.category,
      displayName: label.entityName,
      entityId: label.entityId,
      entityName: label.entityName,
      isIdentified: true,
    };
  }

  private summarizeCategories(entities: EntitySummary[]): EntityCategorySummary[] {
    const categorySummaries = new Map<string, EntityCategorySummary>();

    for (const entity of entities) {
      const current = categorySummaries.get(entity.category);

      categorySummaries.set(entity.category, {
        category: entity.category,
        entityCount: (current?.entityCount ?? 0) + 1,
        labelCount: (current?.labelCount ?? 0) + entity.labelCount,
      });
    }

    return [...categorySummaries.values()].sort((a, b) => b.labelCount - a.labelCount);
  }
}

const toStaticEntityAddressLabel = (label: StaticAddressLabel): EntityAddressLabel => ({
  address: label.address,
  attributionGroup: label.attributionGroup,
  category: label.category,
  confidence: label.confidence,
  countingPolicy: label.countingPolicy,
  entityId: label.entityId,
  entityName: label.entityName,
  firstSeenBlock: null,
  label: label.label,
  logIndex: null,
  poolKind: null,
  role: label.role,
  sourceAddress: null,
  sourceEvent: "base-address-labels",
  sourceType: "static_config",
  token0: null,
  token1: null,
  transactionHash: null,
});

const toDiscoveredEntityAddressLabel = (row: DiscoveredAddressLabelRow): EntityAddressLabel => ({
  address: row.address,
  attributionGroup: row.attributionGroup,
  category: row.category,
  confidence: row.confidence,
  countingPolicy: row.countingPolicy,
  entityId: row.entityId,
  entityName: row.entityName,
  firstSeenBlock: row.firstSeenBlock,
  label: row.label,
  logIndex: row.logIndex,
  poolKind: row.poolKind,
  role: row.role,
  sourceAddress: row.sourceAddress,
  sourceEvent: row.sourceEvent,
  sourceType: row.sourceType,
  token0: row.token0,
  token1: row.token1,
  transactionHash: row.transactionHash,
});

const getStaticEntityIdentity = (entityId: string): EntityIdentity | null => {
  const staticLabel = baseAddressLabels.find((label) => label.entityId === entityId);

  if (staticLabel === undefined) {
    return null;
  }

  return {
    category: staticLabel.category,
    entityId,
    entityName: staticLabel.entityName,
  };
};

const compareEntityAddressLabels = (a: EntityRegistryLabel, b: EntityRegistryLabel) => {
  return (
    compareCountingPolicy(a.countingPolicy, b.countingPolicy) ||
    a.role.localeCompare(b.role) ||
    compareNullableBlocks(a.firstSeenBlock, b.firstSeenBlock) ||
    a.address.localeCompare(b.address)
  );
};

const compareCountingPolicy = (a: string, b: string) => {
  const rank: Record<string, number> = {
    boundary: 0,
    discovery_source: 1,
    internal: 2,
    ignore: 3,
  };

  return (rank[a] ?? 99) - (rank[b] ?? 99);
};

const compareNullableBlocks = (a: string | null, b: string | null) => {
  if (a === b) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return compareBigIntAsc(BigInt(a), BigInt(b));
};

const reduceCounterpartyRows = (entityId: string, rows: EntityPairFlowAggregateRow[]) => {
  const draftsByEntityId = new Map<string, CounterpartyDraft>();

  for (const row of rows) {
    const amount = BigInt(row.totalValue);
    const transferCount = BigInt(row.transferCount);

    if (amount <= 0n || transferCount <= 0n) {
      continue;
    }

    if (row.toEntityId === entityId && row.fromEntityId !== entityId) {
      const draft = upsertCounterpartyDraft(draftsByEntityId, {
        category: row.fromCategory,
        entityId: row.fromEntityId,
        entityName: row.fromEntityName,
      });

      draft.inflow += amount;
      draft.transferCount += transferCount;
    }

    if (row.fromEntityId === entityId && row.toEntityId !== entityId) {
      const draft = upsertCounterpartyDraft(draftsByEntityId, {
        category: row.toCategory,
        entityId: row.toEntityId,
        entityName: row.toEntityName,
      });

      draft.outflow += amount;
      draft.transferCount += transferCount;
    }
  }

  return [...draftsByEntityId.values()];
};

const upsertCounterpartyDraft = (
  draftsByEntityId: Map<string, CounterpartyDraft>,
  identity: EntityIdentity,
) => {
  const current = draftsByEntityId.get(identity.entityId);

  if (current !== undefined) {
    return current;
  }

  const draft = {
    category: identity.category,
    entityId: identity.entityId,
    entityName: identity.entityName,
    inflow: 0n,
    outflow: 0n,
    transferCount: 0n,
  };

  draftsByEntityId.set(identity.entityId, draft);

  return draft;
};

const toCounterpartyNet = (counterparty: CounterpartyDraft) =>
  counterparty.inflow - counterparty.outflow;

const toEntityDetailWindow = (window: BucketWindow): EntityDetailWindow => ({
  bucketEnd: new Date(window.bucketEndSeconds * 1000).toISOString(),
  bucketStart: new Date(window.bucketStartSeconds * 1000).toISOString(),
  minutes: window.minutes,
});

const getBucketWindow = (
  minutes: number,
  latestBucketStartSeconds: number | null,
): BucketWindow => {
  const bucketEndSeconds =
    latestBucketStartSeconds === null
      ? Math.floor(Date.now() / 60_000) * 60
      : latestBucketStartSeconds + 60;

  return {
    bucketEndSeconds,
    bucketStartSeconds: bucketEndSeconds - minutes * 60,
    minutes,
  };
};

const normalizeWindowMinutes = (windowMinutes: number | undefined) => {
  if (windowMinutes === undefined || !Number.isFinite(windowMinutes)) {
    return defaultWindowMinutes;
  }

  return Math.min(Math.max(Math.trunc(windowMinutes), minWindowMinutes), maxWindowMinutes);
};

const getEntityType = (parties: LiveTransferParty[]) => {
  const categories = [
    ...new Set(
      parties.filter((party) => party.isIdentified).map((party) => formatCategory(party.category)),
    ),
  ];

  return categories.length > 0 ? categories.join(" / ") : "Unidentified";
};

const formatCategory = (category: string) => {
  if (category === "dex") {
    return "DEX";
  }

  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const cropAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const minBlock = (blocks: string[]): string | null => {
  const firstBlock = blocks.at(0);

  if (firstBlock === undefined) {
    return null;
  }

  return blocks.reduce((min, block) => (BigInt(block) < BigInt(min) ? block : min), firstBlock);
};

const maxBlock = (blocks: string[]): string | null => {
  const firstBlock = blocks.at(0);

  if (firstBlock === undefined) {
    return null;
  }

  return blocks.reduce((max, block) => (BigInt(block) > BigInt(max) ? block : max), firstBlock);
};

const abs = (value: bigint) => (value < 0n ? -value : value);

const compareBigIntAsc = (a: bigint, b: bigint) => {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
};

const compareBigIntDesc = (a: bigint, b: bigint) => {
  if (a === b) {
    return 0;
  }

  return a > b ? -1 : 1;
};
