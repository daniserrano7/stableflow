import { ponder } from "ponder:registry";
import { usdcTransfers } from "ponder:schema";
import { formatUnits } from "viem";
import { base } from "viem/chains";
import { baseUsdc } from "../chains/base.chain.js";

ponder.on("BaseUsdc:Transfer", async ({ event, context }) => {
  const amount = formatUnits(event.args.value, baseUsdc.decimals);
  const transferId = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
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

  console.log("Base USDC transfer", {
    amount,
    blockNumber: event.block.number.toString(),
    from: event.args.from,
    logIndex: event.log.logIndex,
    to: event.args.to,
    transactionHash: event.transaction.hash,
  });
});
