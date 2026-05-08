import { ponder } from "ponder:registry";
import { usdcTransfers, usdcTransferVolumeBuckets } from "ponder:schema";
import { formatUnits } from "viem";
import { base } from "viem/chains";
import { baseUsdc } from "../chains/base.chain.js";

const bucketSize = "1m";
const bucketSizeSeconds = 60n;

type BlockStats = {
  bucketStart: bigint;
  insertedCount: number;
  processedCount: number;
  totalValue: bigint;
};

const blockStats = new Map<bigint, BlockStats>();

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
