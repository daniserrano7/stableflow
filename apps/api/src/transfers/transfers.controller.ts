import { Controller, Get, Query, Sse } from "@nestjs/common";
import { TransfersService } from "./transfers.service.js";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get("recent")
  listRecentTransfers(@Query("limit") limit?: string) {
    return this.transfersService.listRecentTransfers(Number(limit));
  }

  @Sse("live")
  streamLiveTransfers(
    @Query("afterBlockNumber") afterBlockNumber?: string,
    @Query("afterLogIndex") afterLogIndex?: string,
  ) {
    return this.transfersService.createLiveTransfersStream(
      afterBlockNumber !== undefined && afterLogIndex !== undefined
        ? {
            blockNumber: afterBlockNumber,
            logIndex: Number(afterLogIndex),
          }
        : null,
    );
  }
}
