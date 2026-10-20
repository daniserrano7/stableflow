import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateApiEnv } from "./config/env.js";
import { DatabaseModule } from "./database/database.module.js";
import { EntitiesModule } from "./entities/entities.module.js";
import { FlowsModule } from "./flows/flows.module.js";
import { HealthModule } from "./health/health.module.js";
import { SearchModule } from "./search/search.module.js";
import { TransfersModule } from "./transfers/transfers.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: [".env.local", ".env"],
      expandVariables: true,
      isGlobal: true,
      validate: validateApiEnv,
    }),
    DatabaseModule,
    EntitiesModule,
    FlowsModule,
    HealthModule,
    SearchModule,
    TransfersModule,
  ],
})
export class AppModule {}
