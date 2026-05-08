import { createConfig } from "ponder";
import { erc20Abi, parseAbi } from "viem";
import { base } from "viem/chains";
import {
  baseDiscoveryStartBlock,
  baseProtocolFactories,
  baseRpcUrl,
  baseUsdc,
} from "./src/chains/base.chain.js";

const uniswapV3FactoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
]);

const aerodromePoolFactoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, bool indexed stable, address pool, uint256 poolIndex)",
]);

const metaMorphoVaultFactoryAbi = parseAbi([
  "event CreateMetaMorpho(address indexed metaMorpho, address indexed caller, address initialOwner, uint256 initialTimelock, address indexed asset, string name, string symbol, bytes32 salt)",
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
      startBlock: baseDiscoveryStartBlock,
    },
    MetaMorphoVaultFactory: {
      abi: metaMorphoVaultFactoryAbi,
      chain: "base",
      address: baseProtocolFactories.metaMorphoVaultFactory,
      startBlock: baseDiscoveryStartBlock,
    },
    PancakeSwapV3Factory: {
      abi: uniswapV3FactoryAbi,
      chain: "base",
      address: baseProtocolFactories.pancakeSwapV3Factory,
      startBlock: baseDiscoveryStartBlock,
    },
    UniswapV3Factory: {
      abi: uniswapV3FactoryAbi,
      chain: "base",
      address: baseProtocolFactories.uniswapV3Factory,
      startBlock: baseDiscoveryStartBlock,
    },
  },
  blocks: {
    AaveReserveDiscovery: {
      chain: "base",
      startBlock: baseDiscoveryStartBlock,
      interval: 1800,
    },
  },
});
