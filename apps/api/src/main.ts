import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import type { ApiEnvironment } from "./config/env.js";

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<ApiEnvironment, true>>(ConfigService);
  const port = configService.getOrThrow("PORT");

  app.enableShutdownHooks();
  app.setGlobalPrefix("v1");

  await app.listen(port);

  console.log(`Stableflow API listening on http://localhost:${port.toString()}`);
};

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
