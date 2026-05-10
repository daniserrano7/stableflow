import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class HealthService {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  getHealth() {
    return {
      service: "stableflow-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    await this.databaseService.db.execute(sql`select 1`);

    return {
      checks: {
        database: "ok",
      },
      service: "stableflow-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
