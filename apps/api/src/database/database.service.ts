import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as indexerSchema from "@stableflow/indexer/ponder-schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { ApiEnvironment } from "../config/env.js";

const { Pool } = pg;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: pg.Pool;
  readonly db: NodePgDatabase<typeof indexerSchema>;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<ApiEnvironment, true>,
  ) {
    this.pool = new Pool({
      application_name: "stableflow-api",
      connectionString: this.configService.getOrThrow("DATABASE_URL"),
      max: 5,
    });

    this.db = drizzle(this.pool, { schema: indexerSchema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
