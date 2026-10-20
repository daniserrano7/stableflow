import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Sse,
} from "@nestjs/common";
import { parseTransferId, parseTransferListParams, type TransferFilter } from "@stableflow/shared";
import { parseLiveTransferEventId } from "./live-transfer-event-id.js";
import { TransfersService } from "./transfers.service.js";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  listTransfers(
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
    let params: ReturnType<typeof parseTransferListParams>;
    try {
      params = parseTransferListParams(query);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid parameters");
    }
    return this.transfersService.listTransfers(params);
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
    @Query("filter") filter?: string,
  ) {
    const transferFilter = filter ?? "all";
    if (!isTransferFilter(transferFilter)) {
      throw new BadRequestException("Filter must be all, large, or whale.");
    }
    const resumedCursor = parseLiveTransferEventId(lastEventId);
    const initialCursor =
      afterBlockNumber !== undefined && afterLogIndex !== undefined
        ? parseLiveTransferEventId(`${afterBlockNumber}:${afterLogIndex}`)
        : undefined;

    return this.transfersService.createLiveTransfersStream(
      resumedCursor !== undefined ? resumedCursor : (initialCursor ?? null),
      transferFilter,
    );
  }

  // Declared last so the static "recent" and "live" routes win over this parameter.
  @Get(":transferId")
  async getTransfer(@Param("transferId") transferId: string) {
    const parsed = parseTransferId(transferId);
    if (parsed === null) throw new BadRequestException("Invalid transfer ID.");
    const transfer = await this.transfersService.getTransfer(parsed);
    if (transfer === null) throw new NotFoundException("Transfer not found.");
    return transfer;
  }
}

const isTransferFilter = (value: string): value is TransferFilter =>
  value === "all" || value === "large" || value === "whale";
