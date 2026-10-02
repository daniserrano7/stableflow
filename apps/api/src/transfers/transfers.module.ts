import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { TransfersController } from "./transfers.controller.js";
import { TransfersService } from "./transfers.service.js";

@Module({
  controllers: [TransfersController],
  imports: [DatabaseModule],
  providers: [TransfersService],
})
export class TransfersModule {}
