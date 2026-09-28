import { BadRequestException, Controller, Get, Headers, Query, Sse } from "@nestjs/common";
import { parseMovementParams } from "@stableflow/shared";
import { parseLiveTransferEventId } from "./live-transfer-event-id.js";
import { TransfersService } from "./transfers.service.js";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  listMovements(
    @Query("filter") filter?: string,
    @Query("cursor") cursor?: string,
    @Query("direction") direction?: string,
    @Query("limit") limit?: string,
  ) {
    const query = new URLSearchParams();
    if (filter !== undefined) query.set("filter", filter);
    if (cursor !== undefined) query.set("cursor", cursor);
    if (direction !== undefined) query.set("direction", direction);
    if (limit !== undefined) query.set("limit", limit);
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
    @Headers("last-event-id") lastEventId?: string,
  ) {
    const resumedCursor = parseLiveTransferEventId(lastEventId);
    const initialCursor =
      afterBlockNumber !== undefined && afterLogIndex !== undefined
        ? parseLiveTransferEventId(`${afterBlockNumber}:${afterLogIndex}`)
        : undefined;

    return this.transfersService.createLiveTransfersStream(
      resumedCursor !== undefined ? resumedCursor : (initialCursor ?? null),
    );
  }
}
