import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import * as indexerSchema from "@stableflow/indexer/ponder-schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    application_name: "stableflow-api",
    connectionString: env.DATABASE_URL,
    max: 5,
  });

  readonly db = drizzle(this.pool, { schema: indexerSchema });

  async onModuleDestroy() {
    await this.pool.end();
  }
}
