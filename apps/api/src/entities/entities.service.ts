import { Injectable } from "@nestjs/common";
import { discoveredAddressLabels } from "@stableflow/indexer/ponder-schema";
import type { EntityCategorySummary, EntityListResponse, EntitySummary } from "@stableflow/shared";
import { desc, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";

interface EntitySummaryRow {
  addressCount: number;
  category: string;
  entityId: string;
  entityName: string;
  firstSeenBlock: string | null;
  labelCount: number;
  latestSeenBlock: string | null;
  roles: string[];
  sourceTypes: string[];
}

@Injectable()
export class EntitiesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listEntities(): Promise<EntityListResponse> {
    const rows = await this.databaseService.db
      .select({
        addressCount: sql<number>`count(distinct ${discoveredAddressLabels.address})::int`,
        category: discoveredAddressLabels.category,
        entityId: discoveredAddressLabels.entityId,
        entityName: discoveredAddressLabels.entityName,
        firstSeenBlock: sql<string | null>`min(${discoveredAddressLabels.firstSeenBlock})::text`,
        labelCount: sql<number>`count(*)::int`,
        latestSeenBlock: sql<string | null>`max(${discoveredAddressLabels.firstSeenBlock})::text`,
        roles: sql<
          string[]
        >`array_agg(distinct ${discoveredAddressLabels.role} order by ${discoveredAddressLabels.role})`,
        sourceTypes: sql<
          string[]
        >`array_agg(distinct ${discoveredAddressLabels.sourceType} order by ${discoveredAddressLabels.sourceType})`,
      })
      .from(discoveredAddressLabels)
      .groupBy(
        discoveredAddressLabels.entityId,
        discoveredAddressLabels.entityName,
        discoveredAddressLabels.category,
      )
      .orderBy(desc(sql`count(*)`));

    const entities = rows.map((row) => this.toEntitySummary(row));

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

  private toEntitySummary(row: EntitySummaryRow): EntitySummary {
    return {
      addressCount: row.addressCount,
      category: row.category,
      entityId: row.entityId,
      entityName: row.entityName,
      firstSeenBlock: row.firstSeenBlock,
      labelCount: row.labelCount,
      latestSeenBlock: row.latestSeenBlock,
      roles: row.roles,
      sourceTypes: row.sourceTypes,
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
