import { env } from "../env/env.js";

export const baseRpcUrl = env.PONDER_RPC_URL_8453;

export const baseUsdc = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
  symbol: "USDC",
} as const;

export const baseProtocolFactories = {
  aerodromePoolFactory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
  pancakeSwapV3Factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  uniswapV3Factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
} as const;
