import { env } from "../env/env.js";

export const baseRpcUrl = env.PONDER_RPC_URL_8453;
export const baseDiscoveryStartBlock = env.PONDER_DISCOVERY_START_BLOCK_8453 ?? "latest";

export const baseUsdc = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
  symbol: "USDC",
} as const;

export const baseProtocolFactories = {
  aerodromePoolFactory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
  aerodromeSlipstream3Factory: "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef",
  aerodromeSlipstreamFactory: "0x5e7BB104d84C7CB9b682AAC2F3D509f5F406809A",
  aerodromeSlipstreamPoolFactory: "0xeC8E5342B19977B4eF8892e02D8DAEcfa1315831",
  metaMorphoVaultFactory: "0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101",
  pancakeSwapV3Factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  uniswapV3Factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
} as const;

export const baseProtocolContracts = {
  aaveV3Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  acrossSpokePool: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
  circleCctpMessageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
  circleCctpTokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
} as const;
