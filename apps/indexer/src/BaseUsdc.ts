import { ponder } from "ponder:registry";
import { formatUnits } from "viem";
import { baseUsdc } from "./config/base.js";

ponder.on("BaseUsdc:Transfer", async ({ event }) => {
  const amount = formatUnits(event.args.value, baseUsdc.decimals);

  console.log("Base USDC transfer", {
    amount,
    blockNumber: event.block.number.toString(),
    from: event.args.from,
    logIndex: event.log.logIndex,
    to: event.args.to,
    transactionHash: event.transaction.hash,
  });
});
