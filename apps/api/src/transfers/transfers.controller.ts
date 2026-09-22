import { BadRequestException, Controller, Get, Query, Sse } from "@nestjs/common";
import { parseMovementParams } from "@stableflow/shared";
import { TransfersService } from "./transfers.service.js";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  listMovements(
    @Query("filter") filter?: string,
    @Query("cursor") cursor?: string,
    @Query("direction") direction?: string,
  ) {
    const query = new URLSearchParams();
    if (filter !== undefined) query.set("filter", filter);
    if (cursor !== undefined) query.set("cursor", cursor);
    if (direction !== undefined) query.set("direction", direction);
    let params: ReturnType<typeof parseMovementParams>;
    try {
      params = parseMovementParams(query);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid parameters");
    }
    return this.transfersService.listMovements(params);
  }

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
