import { ponder } from "ponder:registry";
import { usdcEntityFlowBuckets, usdcTransfers, usdcTransferVolumeBuckets } from "ponder:schema";
import { formatUnits } from "viem";
import { base } from "viem/chains";
import { baseUsdc } from "../chains/base.chain.js";
import {
  type AddressLabel,
  getBaseAddressLabel,
  isFlowBoundaryLabel,
} from "../labels/base-address-labels.js";

const bucketSize = "1m";
const bucketSizeSeconds = 60n;

type BlockStats = {
  bucketStart: bigint;
  insertedCount: number;
  processedCount: number;
  totalValue: bigint;
};

const blockStats = new Map<bigint, BlockStats>();

type FlowDirection = "in" | "out";

type FlowLabel = Pick<AddressLabel, "attributionGroup" | "category" | "entityId" | "entityName">;

type EntityFlowUpdate = {
  direction: FlowDirection;
  label: FlowLabel;
};

const unidentifiedLabel = {
  attributionGroup: "unidentified",
  category: "unidentified",
  entityId: "unidentified",
  entityName: "Unidentified",
} as const;

const logCompletedBlocks = (currentBlockNumber: bigint) => {
  for (const [blockNumber, stats] of blockStats) {
    if (blockNumber >= currentBlockNumber) {
      continue;
    }

    const volume = formatUnits(stats.totalValue, baseUsdc.decimals);

    console.log(
      `[indexer] Base USDC block ${blockNumber.toString()} | events=${stats.processedCount} | indexed=${stats.insertedCount} | volume=${volume} ${baseUsdc.symbol} | bucket=${new Date(
        Number(stats.bucketStart) * 1000,
      ).toISOString()}`,
    );

    blockStats.delete(blockNumber);
  }
};

const getEntityFlowUpdates = ({
  fromLabel,
  toLabel,
}: {
  fromLabel: AddressLabel | undefined;
  toLabel: AddressLabel | undefined;
}) => {
  if (
    fromLabel !== undefined &&
    toLabel !== undefined &&
    fromLabel.attributionGroup === toLabel.attributionGroup
  ) {
    return [];
  }

  const updates: EntityFlowUpdate[] = [];
  const fromFlowLabel = isFlowBoundaryLabel(fromLabel) ? fromLabel : undefined;
  const toFlowLabel = isFlowBoundaryLabel(toLabel) ? toLabel : undefined;

  if (fromFlowLabel === undefined && toFlowLabel === undefined) {
    updates.push({
      direction: "out",
      label: unidentifiedLabel,
    });
    updates.push({
      direction: "in",
      label: unidentifiedLabel,
    });

    return updates;
  }

  if (fromFlowLabel !== undefined) {
    updates.push({
      direction: "out",
      label: fromFlowLabel,
    });
  } else if (toFlowLabel !== undefined) {
    updates.push({
      direction: "out",
      label: unidentifiedLabel,
    });
  }

  if (toFlowLabel !== undefined) {
    updates.push({
      direction: "in",
      label: toFlowLabel,
    });
  } else if (fromFlowLabel !== undefined) {
    updates.push({
      direction: "in",
      label: unidentifiedLabel,
    });
  }

  return updates;
};

ponder.on("BaseUsdc:Transfer", async ({ event, context }) => {
  logCompletedBlocks(event.block.number);

  const transferId = `${event.transaction.hash}-${event.log.logIndex}`;
  const bucketStart = event.block.timestamp - (event.block.timestamp % bucketSizeSeconds);
  const bucketId = `${base.id}:${baseUsdc.address}:${bucketSize}:${bucketStart.toString()}`;

  const insertedTransfer = await context.db
    .insert(usdcTransfers)
    .values({
      id: transferId,
      chainId: base.id,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      fromAddress: event.args.from,
      toAddress: event.args.to,
      value: event.args.value,
    })
    .onConflictDoNothing();

  if (insertedTransfer !== null) {
    await context.db
      .insert(usdcTransferVolumeBuckets)
      .values({
        id: bucketId,
        chainId: base.id,
        tokenAddress: baseUsdc.address,
        bucketSize,
        bucketStart,
        transferCount: 1n,
        totalValue: event.args.value,
      })
      .onConflictDoUpdate((row) => ({
        transferCount: row.transferCount + 1n,
        totalValue: row.totalValue + event.args.value,
      }));

    const entityFlowUpdates = getEntityFlowUpdates({
      fromLabel: getBaseAddressLabel(event.args.from),
      toLabel: getBaseAddressLabel(event.args.to),
    });

    for (const { direction, label } of entityFlowUpdates) {
      const entityFlowBucketId = [
        base.id,
        baseUsdc.address,
        bucketSize,
        bucketStart.toString(),
        label.entityId,
        direction,
      ].join(":");

      await context.db
        .insert(usdcEntityFlowBuckets)
        .values({
          id: entityFlowBucketId,
          chainId: base.id,
          tokenAddress: baseUsdc.address,
          bucketSize,
          bucketStart,
          entityId: label.entityId,
          entityName: label.entityName,
          category: label.category,
          direction,
          transferCount: 1n,
          totalValue: event.args.value,
        })
        .onConflictDoUpdate((row) => ({
          transferCount: row.transferCount + 1n,
          totalValue: row.totalValue + event.args.value,
        }));
    }
  }

  const stats = blockStats.get(event.block.number) ?? {
    bucketStart,
    insertedCount: 0,
    processedCount: 0,
    totalValue: 0n,
  };

  stats.processedCount += 1;

  if (insertedTransfer !== null) {
    stats.insertedCount += 1;
    stats.totalValue += event.args.value;
  }

  blockStats.set(event.block.number, stats);
});
