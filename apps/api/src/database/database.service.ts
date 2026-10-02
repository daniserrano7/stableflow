import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as indexerSchema from "@stableflow/indexer/ponder-schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { ApiEnvironment } from "../config/env.js";

const { Pool } = pg;

export type IndexerDatabase = NodePgDatabase<typeof indexerSchema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pools: pg.Pool[] = [];
  /** History: archived raw transfers, aggregates and labels. */
  readonly db: IndexerDatabase;
  /** The newest indexed data, a few seconds ahead of the archive. */
  readonly liveDb: IndexerDatabase;

  constructor(private readonly configService: ConfigService<ApiEnvironment, true>) {
    const schema = this.configService.getOrThrow("DATABASE_SCHEMA");
    const liveSchema = this.configService.get("DATABASE_LIVE_SCHEMA", { infer: true }) ?? schema;

    this.db = this.createDatabase(schema, "stableflow-api", 5);
    this.liveDb =
      liveSchema === schema ? this.db : this.createDatabase(liveSchema, "stableflow-api-live", 2);
  }

  private createDatabase(schema: string, applicationName: string, max: number) {
    const pool = new Pool({
      application_name: applicationName,
      connectionString: this.configService.getOrThrow("DATABASE_URL"),
      max,
      options: `-c search_path="${schema}"`,
    });
    this.pools.push(pool);

    return drizzle(pool, { schema: indexerSchema });
  }

  async onModuleDestroy() {
    await Promise.all(this.pools.map((pool) => pool.end()));
  }
}
