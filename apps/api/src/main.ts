import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import type { ApiEnvironment } from "./config/env.js";

const logger = new Logger("Bootstrap");

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<ApiEnvironment, true>>(ConfigService);
  const port = configService.getOrThrow("PORT");

  app.enableShutdownHooks();
  app.setGlobalPrefix("v1");

  await app.listen(port);

  logger.log(`Stableflow API listening on http://localhost:${port.toString()}`);
};

bootstrap().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
