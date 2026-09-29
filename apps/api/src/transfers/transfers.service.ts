import { Injectable, type MessageEvent } from "@nestjs/common";
import { baseAddressLabels } from "@stableflow/indexer/base-address-labels";
import { discoveredAddressLabels, usdcTransfers } from "@stableflow/indexer/ponder-schema";
import type {
  LiveTransferBatchEvent,
  LiveTransferCursor,
  LiveTransferParty,
  LiveTransferRow,
  RecentTransfersResponse,
  TransferDetailResponse,
  TransferListParams,
  TransferListResponse,
} from "@stableflow/shared";
import { transfersPageSize, transferThresholds } from "@stableflow/shared";
import { and, asc, desc, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { concatMap, filter, from, interval, map, merge, Observable, startWith } from "rxjs";
import { DatabaseService } from "../database/database.service.js";
import { baseUsdc, toTokenAmount } from "../tokens/base-usdc.js";
import { toLiveTransferEventId } from "./live-transfer-event-id.js";

const defaultRecentTransfersLimit = 20;
const liveTransfersPollIntervalMs = 1_000;
const liveTransfersHeartbeatIntervalMs = 15_000;
const maxTransactionTransfers = 100;
const baseChainId = 8453;

interface AddressLabel {
  address: string;
  category: string;
  entityId: string;
  entityName: string;
}

interface TransferRecord {
  blockNumber: bigint;
  blockTimestamp: bigint;
  fromAddress: string;
  id: string;
  logIndex: number;
  toAddress: string;
  transactionHash: string;
  value: bigint;
}

@Injectable()
export class TransfersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listRecentTransfers(limit = defaultRecentTransfersLimit): Promise<RecentTransfersResponse> {
    const normalizedLimit = this.normalizeLimit(limit);
    const records = await this.getRecentTransferRecords(normalizedLimit);

    return {
      data: await this.toLiveTransferRows(records),
      meta: {
        generatedAt: new Date().toISOString(),
        limit: normalizedLimit,
      },
    };
  }

  async listTransfers({
    filter,
    cursor,
    direction,
    limit = transfersPageSize,
  }: TransferListParams): Promise<TransferListResponse> {
    const newer = direction === "newer";
    const compare = newer ? gt : lt;
    const order = newer ? asc : desc;
    const records = await this.databaseService.db
      .select(transferRecordColumns)
      .from(usdcTransfers)
      .where(
        and(
          gte(usdcTransfers.value, BigInt(transferThresholds[filter]) * 1_000_000n),
          cursor === null
            ? undefined
            : or(
                compare(usdcTransfers.blockNumber, BigInt(cursor.blockNumber)),
                and(
                  eq(usdcTransfers.blockNumber, BigInt(cursor.blockNumber)),
                  compare(usdcTransfers.logIndex, cursor.logIndex),
                ),
              ),
        ),
      )
      .orderBy(order(usdcTransfers.blockNumber), order(usdcTransfers.logIndex))
      .limit(limit + 1);
    const hasMore = records.length > limit;
    const page = records.slice(0, limit);
    if (newer) page.reverse();
    const first = page.at(0);
    const last = page.at(-1);
    const toCursor = (record: TransferRecord) => `${record.blockNumber}:${record.logIndex}`;
    return {
      data: await this.toLiveTransferRows(page),
      meta: {
        generatedAt: new Date().toISOString(),
        limit,
        filter,
        newerCursor: first && (newer ? hasMore : cursor !== null) ? toCursor(first) : null,
        olderCursor: last && (newer ? cursor !== null : hasMore) ? toCursor(last) : null,
      },
    };
  }

  async getTransfer({
    id,
    transactionHash,
  }: {
    id: string;
    transactionHash: string;
  }): Promise<TransferDetailResponse | null> {
    const hash = transactionHash as `0x${string}`;
    // All lookups hit the transaction hash index; the transfer is one of the siblings.
    const [siblingRecords, transactionTotals] = await Promise.all([
      this.databaseService.db
        .select(transferRecordColumns)
        .from(usdcTransfers)
        .where(eq(usdcTransfers.transactionHash, hash))
        .orderBy(asc(usdcTransfers.logIndex))
        .limit(maxTransactionTransfers),
      this.getTransactionTotals(hash),
    ]);
    let transferRecord = siblingRecords.find((record) => record.id === id);
    if (transferRecord === undefined) {
      // Transactions with more transfers than the cap may leave this one outside the list.
      [transferRecord] = await this.databaseService.db
        .select(transferRecordColumns)
        .from(usdcTransfers)
        .where(eq(usdcTransfers.id, id))
        .limit(1);
    }
    if (transferRecord === undefined) return null;

    const rows = await this.toLiveTransferRows([transferRecord, ...siblingRecords]);
    return {
      data: {
        transfer: rows[0] as LiveTransferRow,
        transaction: {
          adjustedValue: toTokenAmount(transactionTotals.adjustedValue),
          hash: transferRecord.transactionHash,
          transferCount: transactionTotals.transferCount,
          transfers: rows.slice(1),
        },
      },
      meta: {
        chainId: baseChainId,
        generatedAt: new Date().toISOString(),
        tokenAddress: baseUsdc.address,
      },
    };
  }

  /**
   * Counts every transfer in the transaction and its adjusted value: the sum of each address's
   * positive net change, matching the indexer's TransactionNetValueTracker.
   */
  private async getTransactionTotals(transactionHash: `0x${string}`) {
    const result = await this.databaseService.db.execute<{
      adjusted_value: string;
      transfer_count: number;
    }>(sql`
      with transfers as (
        select ${usdcTransfers.fromAddress} as from_address,
               ${usdcTransfers.toAddress} as to_address,
               ${usdcTransfers.value} as value
        from ${usdcTransfers}
        where ${usdcTransfers.transactionHash} = ${transactionHash}
      ),
      nets as (
        select lower(address) as address, sum(delta) as net
        from (
          select to_address as address, value as delta from transfers
          union all
          select from_address, -value from transfers
        ) legs
        group by 1
      )
      select (select count(*) from transfers)::int as transfer_count,
             coalesce((select sum(net) from nets where net > 0), 0)::text as adjusted_value
    `);
    const [totals] = result.rows;
    return {
      adjustedValue: BigInt(totals?.adjusted_value ?? "0"),
      transferCount: totals?.transfer_count ?? 0,
    };
  }

  createLiveTransfersStream(cursor: LiveTransferCursor | null): Observable<MessageEvent> {
    let latestCursor = cursor;

    const transfers = interval(liveTransfersPollIntervalMs).pipe(
      startWith(0),
      concatMap(() =>
        from(
          this.getLiveTransferBatch(latestCursor).then((batch) => {
            latestCursor = batch.cursor;
            return batch;
          }),
        ),
      ),
      filter((batch) => batch.transfers.length > 0),
      map((batch) => ({
        data: batch,
        id: toLiveTransferEventId(batch.cursor),
        type: "transfers",
      })),
    );

    const heartbeats = interval(liveTransfersHeartbeatIntervalMs).pipe(
      startWith(0),
      map(() => ({
        data: { generatedAt: new Date().toISOString() },
        id: toLiveTransferEventId(latestCursor),
        type: "heartbeat",
      })),
    );

    return merge(transfers, heartbeats);
  }

  private async getLiveTransferBatch(
    cursor: LiveTransferCursor | null,
  ): Promise<LiveTransferBatchEvent> {
    const records =
      cursor === null
        ? await this.getRecentTransferRecords(defaultRecentTransfersLimit)
        : await this.getTransferRecordsAfterCursor(cursor, defaultRecentTransfersLimit);
    const rows = await this.toLiveTransferRows(records);
    const latestRow = cursor === null ? rows.at(0) : rows.at(-1);

    return {
      cursor: latestRow?.cursor ?? cursor,
      generatedAt: new Date().toISOString(),
      transfers: rows,
    };
  }

  private async getRecentTransferRecords(limit: number): Promise<TransferRecord[]> {
    const records = await this.databaseService.db
      .select(transferRecordColumns)
      .from(usdcTransfers)
      .orderBy(desc(usdcTransfers.blockNumber), desc(usdcTransfers.logIndex))
      .limit(limit);

    return records;
  }

  private async getTransferRecordsAfterCursor(
    cursor: LiveTransferCursor,
    limit: number,
  ): Promise<TransferRecord[]> {
    return this.databaseService.db
      .select(transferRecordColumns)
      .from(usdcTransfers)
      .where(
        or(
          gt(usdcTransfers.blockNumber, BigInt(cursor.blockNumber)),
          and(
            eq(usdcTransfers.blockNumber, BigInt(cursor.blockNumber)),
            gt(usdcTransfers.logIndex, cursor.logIndex),
          ),
        ),
      )
      .orderBy(asc(usdcTransfers.blockNumber), asc(usdcTransfers.logIndex))
      .limit(limit);
  }

  private async toLiveTransferRows(records: TransferRecord[]): Promise<LiveTransferRow[]> {
    const labels = await this.getLabelsForTransferRecords(records);

    return records.map((record) => {
      const from = this.toTransferParty(record.fromAddress, labels);
      const to = this.toTransferParty(record.toAddress, labels);

      return {
        amount: toTokenAmount(record.value),
        blockNumber: record.blockNumber.toString(),
        blockTimestamp: new Date(Number(record.blockTimestamp) * 1000).toISOString(),
        cursor: {
          blockNumber: record.blockNumber.toString(),
          logIndex: record.logIndex,
        },
        entityType: getEntityType([from, to]),
        from,
        id: record.id,
        logIndex: record.logIndex,
        to,
        transactionHash: record.transactionHash,
      };
    });
  }

  private async getLabelsForTransferRecords(
    records: TransferRecord[],
  ): Promise<Map<string, AddressLabel>> {
    const labelsByAddress = new Map<string, AddressLabel>();

    for (const label of baseAddressLabels) {
      labelsByAddress.set(label.address.toLowerCase(), label);
    }

    const missingAddresses = [
      ...new Set(
        records
          .flatMap((record) => [record.fromAddress, record.toAddress])
          .map((address) => address.toLowerCase())
          .filter((address) => !labelsByAddress.has(address)),
      ),
    ];

    if (missingAddresses.length === 0) {
      return labelsByAddress;
    }

    const discoveredLabels = await this.databaseService.db
      .select({
        address: discoveredAddressLabels.address,
        category: discoveredAddressLabels.category,
        entityId: discoveredAddressLabels.entityId,
        entityName: discoveredAddressLabels.entityName,
      })
      .from(discoveredAddressLabels)
      .where(inArray(discoveredAddressLabels.address, missingAddresses as `0x${string}`[]));

    for (const label of discoveredLabels) {
      labelsByAddress.set(label.address.toLowerCase(), label);
    }

    return labelsByAddress;
  }

  private toTransferParty(address: string, labels: Map<string, AddressLabel>): LiveTransferParty {
    const label = labels.get(address.toLowerCase());

    if (label === undefined) {
      return {
        address,
        category: "unidentified",
        displayName: cropAddress(address),
        entityId: null,
        entityName: null,
        isIdentified: false,
      };
    }

    return {
      address,
      category: label.category,
      displayName: label.entityName,
      entityId: label.entityId,
      entityName: label.entityName,
      isIdentified: true,
    };
  }

  private normalizeLimit(limit: number) {
    if (!Number.isFinite(limit)) {
      return defaultRecentTransfersLimit;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), defaultRecentTransfersLimit);
  }
}

const cropAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const getEntityType = (parties: LiveTransferParty[]) => {
  const categories = [
    ...new Set(
      parties.filter((party) => party.isIdentified).map((party) => formatCategory(party.category)),
    ),
  ];

  return categories.length > 0 ? categories.join(" / ") : "Unidentified";
};

const formatCategory = (category: string) => {
  if (category === "dex") {
    return "DEX";
  }

  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const transferRecordColumns = {
  blockNumber: usdcTransfers.blockNumber,
  blockTimestamp: usdcTransfers.blockTimestamp,
  fromAddress: usdcTransfers.fromAddress,
  id: usdcTransfers.id,
  logIndex: usdcTransfers.logIndex,
  toAddress: usdcTransfers.toAddress,
  transactionHash: usdcTransfers.transactionHash,
  value: usdcTransfers.value,
};
