import { Injectable } from "@nestjs/common";
import { usdcEntityFlowBuckets } from "@stableflow/indexer/ponder-schema";
import type {
  TopEntityFlowMode,
  TopEntityFlowRow,
  TopEntityFlowsResponse,
} from "@stableflow/shared";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { toTokenAmount } from "../tokens/base-usdc.js";

const defaultLimit = 8;
const defaultMode = "net" satisfies TopEntityFlowMode;
const defaultWindowMinutes = 15;
const includeUnidentified = true;
const maxLimit = 20;
const maxWindowMinutes = 24 * 60;
const minWindowMinutes = 1;
const oneMinuteBucketSize = "1m";

interface TopEntityFlowOptions {
  limit?: number;
  mode?: TopEntityFlowMode;
  windowMinutes?: number;
}

interface EntityFlowAggregateRow {
  category: string;
  entityId: string;
  entityName: string;
  inflowTransferCount: string;
  inflowValue: string;
  outflowTransferCount: string;
  outflowValue: string;
}

@Injectable()
export class FlowsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listTopEntityFlows(options: TopEntityFlowOptions): Promise<TopEntityFlowsResponse> {
    const limit = normalizeLimit(options.limit);
    const mode = normalizeMode(options.mode);
    const windowMinutes = normalizeWindowMinutes(options.windowMinutes);
    const latestBucketStartSeconds = await this.getLatestBucketStartSeconds();
    const window = getBucketWindow(windowMinutes, latestBucketStartSeconds);

    if (latestBucketStartSeconds === null) {
      return {
        data: [],
        meta: {
          generatedAt: new Date().toISOString(),
          includeUnidentified,
          limit,
          mode,
          window: {
            bucketEnd: new Date(window.bucketEndSeconds * 1000).toISOString(),
            bucketStart: new Date(window.bucketStartSeconds * 1000).toISOString(),
            minutes: window.minutes,
          },
        },
      };
    }

    const rows = await this.databaseService.db
      .select({
        category: usdcEntityFlowBuckets.category,
        entityId: usdcEntityFlowBuckets.entityId,
        entityName: usdcEntityFlowBuckets.entityName,
        inflowTransferCount: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.transferCount}) filter (where ${usdcEntityFlowBuckets.direction} = 'in'), 0)::text`,
        inflowValue: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.totalValue}) filter (where ${usdcEntityFlowBuckets.direction} = 'in'), 0)::text`,
        outflowTransferCount: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.transferCount}) filter (where ${usdcEntityFlowBuckets.direction} = 'out'), 0)::text`,
        outflowValue: sql<string>`coalesce(sum(${usdcEntityFlowBuckets.totalValue}) filter (where ${usdcEntityFlowBuckets.direction} = 'out'), 0)::text`,
      })
      .from(usdcEntityFlowBuckets)
      .where(
        and(
          eq(usdcEntityFlowBuckets.bucketSize, oneMinuteBucketSize),
          gte(usdcEntityFlowBuckets.bucketStart, BigInt(window.bucketStartSeconds)),
          lt(usdcEntityFlowBuckets.bucketStart, BigInt(window.bucketEndSeconds)),
        ),
      )
      .groupBy(
        usdcEntityFlowBuckets.entityId,
        usdcEntityFlowBuckets.entityName,
        usdcEntityFlowBuckets.category,
      );

    return {
      data: toTopEntityFlowRows(rows, mode, limit),
      meta: {
        generatedAt: new Date().toISOString(),
        includeUnidentified,
        limit,
        mode,
        window: {
          bucketEnd: new Date(window.bucketEndSeconds * 1000).toISOString(),
          bucketStart: new Date(window.bucketStartSeconds * 1000).toISOString(),
          minutes: window.minutes,
        },
      },
    };
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
}

const toTopEntityFlowRows = (
  rows: EntityFlowAggregateRow[],
  mode: TopEntityFlowMode,
  limit: number,
): TopEntityFlowRow[] => {
  const sortedRows = rows
    .map((row) => {
      const inflowValue = BigInt(row.inflowValue);
      const outflowValue = BigInt(row.outflowValue);
      const netValue = inflowValue - outflowValue;
      const selectedValue = getSelectedValue(mode, inflowValue, outflowValue, netValue);
      const inflowTransferCount = BigInt(row.inflowTransferCount);
      const outflowTransferCount = BigInt(row.outflowTransferCount);
      const netTransferCount = inflowTransferCount + outflowTransferCount;

      return {
        category: row.category,
        entityId: row.entityId,
        entityName: row.entityName,
        inflowTransferCount,
        inflowValue,
        netValue,
        netTransferCount,
        outflowTransferCount,
        outflowValue,
        selectedMagnitude: abs(selectedValue),
        selectedTransferCount: getSelectedTransferCount(
          mode,
          inflowTransferCount,
          outflowTransferCount,
          netTransferCount,
        ),
        selectedValue,
      };
    })
    .filter((row) => row.selectedMagnitude > 0n)
    .sort((a, b) => compareBigIntDesc(a.selectedMagnitude, b.selectedMagnitude))
    .slice(0, limit);

  const topMagnitude = sortedRows.at(0)?.selectedMagnitude ?? 0n;

  return sortedRows.map((row, index) => ({
    category: row.category,
    entityId: row.entityId,
    entityName: row.entityName,
    inflow: toTokenAmount(row.inflowValue),
    inflowTransferCount: Number(row.inflowTransferCount),
    net: toTokenAmount(row.netValue),
    netTransferCount: Number(row.netTransferCount),
    outflow: toTokenAmount(row.outflowValue),
    outflowTransferCount: Number(row.outflowTransferCount),
    rank: index + 1,
    relativeShare:
      topMagnitude === 0n ? 0 : Number((row.selectedMagnitude * 10_000n) / topMagnitude) / 100,
    selected: toTokenAmount(row.selectedValue),
    selectedTransferCount: Number(row.selectedTransferCount),
    transferCount: Number(row.selectedTransferCount),
  }));
};

const getSelectedValue = (
  mode: TopEntityFlowMode,
  inflowValue: bigint,
  outflowValue: bigint,
  netValue: bigint,
) => {
  if (mode === "inflow") {
    return inflowValue;
  }

  if (mode === "outflow") {
    return outflowValue;
  }

  return netValue;
};

const getSelectedTransferCount = (
  mode: TopEntityFlowMode,
  inflowTransferCount: bigint,
  outflowTransferCount: bigint,
  netTransferCount: bigint,
) => {
  if (mode === "inflow") {
    return inflowTransferCount;
  }

  if (mode === "outflow") {
    return outflowTransferCount;
  }

  return netTransferCount;
};

const normalizeLimit = (limit: number | undefined) => {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxLimit);
};

const normalizeMode = (mode: TopEntityFlowMode | undefined): TopEntityFlowMode => {
  if (mode === "inflow" || mode === "outflow" || mode === "net") {
    return mode;
  }

  return defaultMode;
};

const normalizeWindowMinutes = (windowMinutes: number | undefined) => {
  if (windowMinutes === undefined || !Number.isFinite(windowMinutes)) {
    return defaultWindowMinutes;
  }

  return Math.min(Math.max(Math.trunc(windowMinutes), minWindowMinutes), maxWindowMinutes);
};

const getBucketWindow = (minutes: number, latestBucketStartSeconds: number | null) => {
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

const abs = (value: bigint) => (value < 0n ? -value : value);

const compareBigIntDesc = (a: bigint, b: bigint) => {
  if (a === b) {
    return 0;
  }

  return a > b ? -1 : 1;
};
