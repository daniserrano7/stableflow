import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { EntitiesModule } from "../entities/entities.module.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({
  controllers: [SearchController],
  imports: [DatabaseModule, EntitiesModule],
  providers: [SearchService],
})
export class SearchModule {}
