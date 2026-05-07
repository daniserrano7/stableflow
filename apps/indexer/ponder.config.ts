import { createConfig } from "ponder";
import { erc20Abi } from "viem";
import { base } from "viem/chains";
import { baseRpcUrl, baseUsdc } from "./src/config/base.js";

export default createConfig({
  chains: {
    base: {
      id: base.id,
      rpc: baseRpcUrl,
      ethGetLogsBlockRange: 500,
    },
  },
  contracts: {
    BaseUsdc: {
      abi: erc20Abi,
      chain: "base",
      address: baseUsdc.address,
      startBlock: "latest",
    },
  },
});
