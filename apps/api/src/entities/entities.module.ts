import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { EntitiesController } from "./entities.controller.js";
import { EntitiesService } from "./entities.service.js";

@Module({
  controllers: [EntitiesController],
  exports: [EntitiesService],
  imports: [DatabaseModule],
  providers: [EntitiesService],
})
export class EntitiesModule {}
