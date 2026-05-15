import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { FlowsController } from "./flows.controller.js";
import { FlowsService } from "./flows.service.js";

@Module({
  controllers: [FlowsController],
  imports: [DatabaseModule],
  providers: [FlowsService],
})
export class FlowsModule {}
