import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateApiEnv } from "./config/env.js";
import { DatabaseModule } from "./database/database.module.js";
import { EntitiesModule } from "./entities/entities.module.js";
import { HealthModule } from "./health/health.module.js";
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
    HealthModule,
    TransfersModule,
  ],
})
export class AppModule {}
