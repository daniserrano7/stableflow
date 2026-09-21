import { Injectable } from "@nestjs/common";
import { baseAddressLabels } from "@stableflow/indexer/base-address-labels";
import { discoveredAddressLabels, usdcTransfers } from "@stableflow/indexer/ponder-schema";
import type {
  SearchAddressResult,
  SearchEntityResult,
  SearchResponse,
  SearchTransactionResult,
} from "@stableflow/shared";
import { desc, eq, or, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { EntitiesService } from "../entities/entities.service.js";
import { toTokenAmount } from "../tokens/base-usdc.js";

const addressPattern = /^0x[0-9a-f]{40}$/i;
const hexQueryPattern = /^0x[0-9a-f]+$/i;
const transactionPattern = /^0x[0-9a-f]{64}$/i;

interface RankedResult<T> {
  result: T;
  score: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly entitiesService: EntitiesService,
  ) {}

  async search(rawQuery: string, limit: number): Promise<SearchResponse> {
    const query = rawQuery.trim().toLowerCase();
    const isHexQuery = hexQueryPattern.test(query);

    const [entityResponse, discoveredLabels, transactionRows] = await Promise.all([
      this.entitiesService.listEntities(),
      this.searchDiscoveredLabels(query, limit),
      isHexQuery && query.length >= 10 ? this.searchTransactions(query, limit) : [],
    ]);

    const entities = entityResponse.data
      .map((entity): RankedResult<SearchEntityResult> | null => {
        const score = bestScore(query, [
          [entity.entityName, 0],
          [entity.entityId, 3],
          [entity.category, 12],
          [entity.roles.join(" "), 16],
        ]);

        return score === null
          ? null
          : {
              result: {
                addressCount: entity.addressCount,
                category: entity.category,
                entityId: entity.entityId,
                entityName: entity.entityName,
                type: "entity",
              },
              score,
            };
      })
      .filter(isPresent)
      .sort(compareRankedResults)
      .slice(0, limit)
      .map(({ result }) => result);

    const addressesByValue = new Map<string, RankedResult<SearchAddressResult>>();
    const addressCandidates = [
      ...baseAddressLabels.map((label) => ({ ...label })),
      ...discoveredLabels,
    ];

    for (const label of addressCandidates) {
      const score = bestScore(query, [
        [label.address, 0],
        [label.label ?? "", 6],
        [label.entityName, 10],
        [label.role, 14],
      ]);

      if (score === null) continue;

      const key = label.address.toLowerCase();
      const ranked: RankedResult<SearchAddressResult> = {
        result: {
          address: label.address,
          category: label.category,
          entityId: label.entityId,
          entityName: label.entityName,
          label: label.label,
          role: label.role,
          type: "address",
        },
        score,
      };
      const current = addressesByValue.get(key);

      if (current === undefined || ranked.score < current.score) {
        addressesByValue.set(key, ranked);
      }
    }

    if (addressPattern.test(query) && !addressesByValue.has(query)) {
      addressesByValue.set(query, {
        result: {
          address: query,
          category: "unidentified",
          entityId: null,
          entityName: null,
          label: null,
          role: null,
          type: "address",
        },
        score: 0,
      });
    }

    const addresses = [...addressesByValue.values()]
      .sort(compareRankedResults)
      .slice(0, limit)
      .map(({ result }) => result);
    const seenTransactions = new Set<string>();
    const transactions = transactionRows
      .filter((row) => {
        const key = row.transactionHash.toLowerCase();
        if (seenTransactions.has(key)) return false;
        seenTransactions.add(key);
        return true;
      })
      .map(
        (row): SearchTransactionResult => ({
          amount: toTokenAmount(row.value),
          blockNumber: row.blockNumber.toString(),
          blockTimestamp: new Date(Number(row.blockTimestamp) * 1000).toISOString(),
          fromAddress: row.fromAddress,
          toAddress: row.toAddress,
          transactionHash: row.transactionHash,
          type: "transaction",
        }),
      );
    const data = [...entities, ...addresses, ...transactions];

    return {
      data,
      meta: {
        generatedAt: new Date().toISOString(),
        query: rawQuery.trim(),
        total: data.length,
      },
    };
  }

  private searchDiscoveredLabels(query: string, limit: number) {
    const pattern = `%${escapeLikePattern(query)}%`;
    const condition = addressPattern.test(query)
      ? eq(discoveredAddressLabels.address, query as `0x${string}`)
      : or(
          sql<boolean>`lower(${discoveredAddressLabels.address}::text) like ${pattern} escape '\\'`,
          sql<boolean>`lower(${discoveredAddressLabels.entityName}) like ${pattern} escape '\\'`,
          sql<boolean>`lower(${discoveredAddressLabels.role}) like ${pattern} escape '\\'`,
        );

    return this.databaseService.db
      .select({
        address: discoveredAddressLabels.address,
        category: discoveredAddressLabels.category,
        entityId: discoveredAddressLabels.entityId,
        entityName: discoveredAddressLabels.entityName,
        label: sql<string | null>`null`,
        role: discoveredAddressLabels.role,
      })
      .from(discoveredAddressLabels)
      .where(condition)
      .orderBy(desc(discoveredAddressLabels.firstSeenBlock))
      .limit(limit * 3);
  }

  private searchTransactions(query: string, limit: number) {
    const pattern = `${escapeLikePattern(query)}%`;
    const condition = transactionPattern.test(query)
      ? eq(usdcTransfers.transactionHash, query as `0x${string}`)
      : sql<boolean>`lower(${usdcTransfers.transactionHash}::text) like ${pattern} escape '\\'`;

    return this.databaseService.db
      .select({
        blockNumber: usdcTransfers.blockNumber,
        blockTimestamp: usdcTransfers.blockTimestamp,
        fromAddress: usdcTransfers.fromAddress,
        toAddress: usdcTransfers.toAddress,
        transactionHash: usdcTransfers.transactionHash,
        value: usdcTransfers.value,
      })
      .from(usdcTransfers)
      .where(condition)
      .orderBy(desc(usdcTransfers.blockNumber), desc(usdcTransfers.logIndex))
      .limit(limit * 3);
  }
}

const bestScore = (query: string, fields: Array<[string, number]>) => {
  let best: number | null = null;

  for (const [rawValue, weight] of fields) {
    const value = rawValue.toLowerCase();
    let score: number | null = null;

    if (value === query) score = weight;
    else if (value.startsWith(query)) score = 10 + weight;
    else if (value.split(/[^a-z0-9]+/).some((part) => part.startsWith(query))) score = 18 + weight;
    else if (value.includes(query)) score = 30 + weight;

    if (score !== null && (best === null || score < best)) best = score;
  }

  return best;
};

const compareRankedResults = <T>(a: RankedResult<T>, b: RankedResult<T>) => a.score - b.score;

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const isPresent = <T>(value: T | null): value is T => value !== null;
