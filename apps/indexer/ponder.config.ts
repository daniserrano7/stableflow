import { createConfig } from "ponder";
import { erc20Abi, parseAbi } from "viem";
import { base } from "viem/chains";
import { baseProtocolFactories, baseRpcUrl, baseUsdc } from "./src/chains/base.chain.js";

const uniswapV3FactoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
]);

const aerodromePoolFactoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, bool indexed stable, address pool, uint256 poolIndex)",
]);

export default createConfig({
  chains: {
    base: {
      id: base.id,
      rpc: baseRpcUrl,
      pollingInterval: 2000,
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
    AerodromePoolFactory: {
      abi: aerodromePoolFactoryAbi,
      chain: "base",
      address: baseProtocolFactories.aerodromePoolFactory,
      startBlock: "latest",
    },
    PancakeSwapV3Factory: {
      abi: uniswapV3FactoryAbi,
      chain: "base",
      address: baseProtocolFactories.pancakeSwapV3Factory,
      startBlock: "latest",
    },
    UniswapV3Factory: {
      abi: uniswapV3FactoryAbi,
      chain: "base",
      address: baseProtocolFactories.uniswapV3Factory,
      startBlock: "latest",
    },
  },
  blocks: {
    AaveReserveDiscovery: {
      chain: "base",
      startBlock: "latest",
      interval: 1800,
    },
  },
});
